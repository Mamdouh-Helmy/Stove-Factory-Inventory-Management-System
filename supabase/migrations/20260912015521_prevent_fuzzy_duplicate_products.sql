/*
# Prevent duplicate products caused by small name differences

## Problem
A user can type the same product with a small variation, such as:
- `بوتجاز 5 شعلة` vs `بوتجاز 5 شعله`
- a missing or extra character
- different Arabic letter forms, spacing, or diacritics
The old create function only checked for an exact trimmed name, so it created a second product.

## Database changes
- Add `normalized_name` to `products` for a consistent Arabic-safe comparison key.
- Add `normalize_product_name(text)` to unify common Arabic letter variants, remove diacritics,
  and normalize whitespace.
- Add `product_name_distance(text, text)` using Levenshtein distance for one-character mistakes.
- Replace `create_product_with_stock` so it finds an existing exact or very-close product and adds
a new stock batch to it instead of creating a new product.
- Use a transaction advisory lock keyed by the normalized name so two simultaneous additions cannot
  create duplicate products.
- Replace `update_product` so renaming a product cannot create a duplicate or near-duplicate name.
- Backfill normalized names for existing products.

## Data safety
- Existing batches and inventory transactions are never changed or deleted.
- Product prices and history remain preserved in their original batches.

## Security
- Existing single-tenant RLS policies remain unchanged.
- SECURITY DEFINER functions keep `search_path = public`.
*/

-- ============================================================
-- Name normalization and fuzzy matching helpers
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_product_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := lower(trim(coalesce(p_name, '')));
  v_name := replace(v_name, 'أ', 'ا');
  v_name := replace(v_name, 'إ', 'ا');
  v_name := replace(v_name, 'آ', 'ا');
  v_name := replace(v_name, 'ٱ', 'ا');
  v_name := replace(v_name, 'ة', 'ه');
  v_name := replace(v_name, 'ى', 'ي');
  v_name := replace(v_name, 'ئ', 'ي');
  v_name := replace(v_name, 'ؤ', 'و');
  v_name := replace(v_name, 'ـ', '');
  v_name := regexp_replace(v_name, '[ًٌٍَُِّْـ]', '', 'g');
  v_name := regexp_replace(v_name, '[[:space:]]+', ' ', 'g');
  RETURN trim(v_name);
END;
$$;

CREATE OR REPLACE FUNCTION product_name_distance(p_left text, p_right text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_left text := coalesce(p_left, '');
  v_right text := coalesce(p_right, '');
  v_previous integer[];
  v_current integer[];
  v_i integer;
  v_j integer;
  v_cost integer;
BEGIN
  v_previous := ARRAY(SELECT generate_series(0, length(v_right)));

  IF length(v_left) = 0 THEN
    RETURN length(v_right);
  END IF;
  IF length(v_right) = 0 THEN
    RETURN length(v_left);
  END IF;

  FOR v_i IN 1..length(v_left) LOOP
    v_current := ARRAY(SELECT 0 FROM generate_series(0, length(v_right)));
    v_current[1] := v_i;

    FOR v_j IN 1..length(v_right) LOOP
      IF substr(v_left, v_i, 1) = substr(v_right, v_j, 1) THEN
        v_cost := 0;
      ELSE
        v_cost := 1;
      END IF;

      v_current[v_j + 1] := LEAST(
        v_current[v_j] + 1,
        v_previous[v_j + 1] + 1,
        v_previous[v_j] + v_cost
      );
    END LOOP;

    v_previous := v_current;
  END LOOP;

  RETURN v_previous[length(v_right) + 1];
END;
$$;

ALTER TABLE products ADD COLUMN IF NOT EXISTS normalized_name text;

UPDATE products
SET normalized_name = normalize_product_name(name)
WHERE normalized_name IS NULL OR normalized_name = '';

CREATE INDEX IF NOT EXISTS idx_products_normalized_name ON products(normalized_name);

CREATE OR REPLACE FUNCTION set_product_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := normalize_product_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_products_normalized_name ON products;
CREATE TRIGGER set_products_normalized_name
BEFORE INSERT OR UPDATE OF name ON products
FOR EACH ROW EXECUTE FUNCTION set_product_normalized_name();

-- ============================================================
-- Create or add stock to an existing product
-- ============================================================

CREATE OR REPLACE FUNCTION create_product_with_stock(
  p_name text,
  p_code text DEFAULT NULL,
  p_quantity integer DEFAULT 0,
  p_unit_cost numeric DEFAULT 0,
  p_minimum_stock integer DEFAULT 5,
  p_notes text DEFAULT NULL,
  p_created_by text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_existing_id uuid;
  v_normalized_name text;
  v_existing_normalized_name text;
  v_distance integer;
  v_best_distance integer := NULL;
  v_total_value numeric(14,2);
  v_avg_cost numeric(14,2);
  v_new_quantity integer;
  v_new_total_value numeric(14,2);
  v_old_quantity integer;
  v_old_total_value numeric(14,2);
BEGIN
  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;
  IF p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;
  IF p_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Minimum stock cannot be negative';
  END IF;

  v_normalized_name := normalize_product_name(p_name);
  PERFORM pg_advisory_xact_lock(hashtext(v_normalized_name));

  -- Prefer an exact normalized match.
  SELECT id INTO v_existing_id
  FROM products
  WHERE normalized_name = v_normalized_name
  ORDER BY created_at ASC
  LIMIT 1;

  -- If there is no exact match, accept one-character mistakes only for a meaningful name.
  IF v_existing_id IS NULL AND length(v_normalized_name) >= 5 THEN
    FOR v_existing_id, v_existing_normalized_name IN
      SELECT id, normalized_name
      FROM products
      WHERE length(normalized_name) >= 5
    LOOP
      v_distance := product_name_distance(v_normalized_name, v_existing_normalized_name);
      IF v_distance <= 1 AND (v_best_distance IS NULL OR v_distance < v_best_distance) THEN
        v_best_distance := v_distance;
        v_existing_id := v_existing_id;
      END IF;
    END LOOP;
  END IF;

  -- The loop above needs a separate candidate variable to keep the best match.
  IF v_existing_id IS NULL AND length(v_normalized_name) >= 5 THEN
    DECLARE
      v_candidate_id uuid;
      v_candidate_name text;
    BEGIN
      FOR v_candidate_id, v_candidate_name IN
        SELECT id, normalized_name FROM products WHERE length(normalized_name) >= 5
      LOOP
        v_distance := product_name_distance(v_normalized_name, v_candidate_name);
        IF v_distance <= 1 AND (v_best_distance IS NULL OR v_distance < v_best_distance) THEN
          v_best_distance := v_distance;
          v_existing_id := v_candidate_id;
        END IF;
      END LOOP;
    END;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    v_product_id := v_existing_id;

    IF p_quantity > 0 THEN
      SELECT current_quantity, total_stock_value
      INTO v_old_quantity, v_old_total_value
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;

      v_total_value := ROUND(p_quantity * p_unit_cost, 2);
      v_new_quantity := v_old_quantity + p_quantity;
      v_new_total_value := v_old_total_value + v_total_value;
      v_avg_cost := ROUND(v_new_total_value / v_new_quantity, 2);

      INSERT INTO stock_batches (product_id, initial_quantity, remaining_quantity, unit_cost, total_cost)
      VALUES (v_product_id, p_quantity, p_quantity, p_unit_cost, v_total_value);

      UPDATE products SET
        current_quantity = v_new_quantity,
        total_stock_value = v_new_total_value,
        average_cost = v_avg_cost,
        last_unit_cost = p_unit_cost,
        last_transaction_at = now(),
        updated_at = now()
      WHERE id = v_product_id;

      INSERT INTO inventory_transactions (
        product_id, type, quantity, unit_cost, total_value,
        notes, balance_after, created_by
      )
      VALUES (
        v_product_id, 'STOCK_IN', p_quantity, p_unit_cost, v_total_value,
        p_notes, v_new_quantity, p_created_by
      );
    END IF;

    RETURN v_product_id;
  END IF;

  INSERT INTO products (
    name, normalized_name, code, minimum_stock, current_quantity,
    total_stock_value, average_cost, last_unit_cost, last_transaction_at
  )
  VALUES (
    trim(p_name), v_normalized_name, p_code, p_minimum_stock, 0,
    0, 0, 0, CASE WHEN p_quantity > 0 THEN now() ELSE NULL END
  )
  RETURNING id INTO v_product_id;

  IF p_quantity > 0 THEN
    v_total_value := ROUND(p_quantity * p_unit_cost, 2);
    v_avg_cost := ROUND(v_total_value / p_quantity, 2);

    INSERT INTO stock_batches (product_id, initial_quantity, remaining_quantity, unit_cost, total_cost)
    VALUES (v_product_id, p_quantity, p_quantity, p_unit_cost, v_total_value);

    UPDATE products SET
      current_quantity = p_quantity,
      total_stock_value = v_total_value,
      average_cost = v_avg_cost,
      last_unit_cost = p_unit_cost,
      updated_at = now()
    WHERE id = v_product_id;

    INSERT INTO inventory_transactions (
      product_id, type, quantity, unit_cost, total_value,
      notes, balance_after, created_by
    )
    VALUES (
      v_product_id, 'STOCK_IN', p_quantity, p_unit_cost, v_total_value,
      p_notes, p_quantity, p_created_by
    );
  END IF;

  RETURN v_product_id;
END;
$$;

-- ============================================================
-- Update product without allowing duplicate or near-duplicate names
-- ============================================================

DROP FUNCTION IF EXISTS update_product(uuid, text, text, integer, numeric);

CREATE FUNCTION update_product(
  p_product_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_minimum_stock integer DEFAULT 5,
  p_last_unit_cost numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_name text;
  v_other_id uuid;
  v_other_name text;
  v_distance integer;
BEGIN
  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF p_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Minimum stock cannot be negative';
  END IF;
  IF p_last_unit_cost IS NOT NULL AND p_last_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  v_normalized_name := normalize_product_name(p_name);
  PERFORM pg_advisory_xact_lock(hashtext(v_normalized_name));

  SELECT id, name INTO v_other_id, v_other_name
  FROM products
  WHERE normalized_name = v_normalized_name AND id <> p_product_id
  LIMIT 1;

  IF v_other_id IS NOT NULL THEN
    RAISE EXCEPTION 'A similar product already exists: %', v_other_name;
  END IF;

  IF length(v_normalized_name) >= 5 THEN
    FOR v_other_id, v_other_name IN
      SELECT id, name FROM products WHERE id <> p_product_id AND length(normalized_name) >= 5
    LOOP
      v_distance := product_name_distance(v_normalized_name, normalize_product_name(v_other_name));
      IF v_distance <= 1 THEN
        RAISE EXCEPTION 'A similar product already exists: %', v_other_name;
      END IF;
    END LOOP;
  END IF;

  UPDATE products SET
    name = trim(p_name),
    normalized_name = v_normalized_name,
    code = p_code,
    minimum_stock = p_minimum_stock,
    last_unit_cost = COALESCE(p_last_unit_cost, last_unit_cost),
    updated_at = now()
  WHERE id = p_product_id;
END;
$$;
