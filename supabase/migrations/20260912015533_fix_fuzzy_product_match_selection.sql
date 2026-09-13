//supabase/migrations/20260912015533_fix_fuzzy_product_match_selection.sql
/*
# Fix fuzzy product selection

## Problem
The first fuzzy-match loop could leave the last scanned product ID in the variable even
when no product matched. That could incorrectly add stock to an unrelated product.

## Fix
- Replace the matching function with a single exact-match-then-nearest-match flow.
- Only assign an existing product ID when the normalized names are equal or their
  Levenshtein distance is exactly one or less.
- Never select an unrelated product when no match exists.
*/

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
  v_candidate_id uuid;
  v_normalized_name text;
  v_candidate_name text;
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

  SELECT id INTO v_existing_id
  FROM products
  WHERE normalized_name = v_normalized_name
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_existing_id IS NULL AND length(v_normalized_name) >= 5 THEN
    FOR v_candidate_id, v_candidate_name IN
      SELECT id, normalized_name
      FROM products
      WHERE length(normalized_name) >= 5
    LOOP
      v_distance := product_name_distance(v_normalized_name, v_candidate_name);
      IF v_distance <= 1 AND (v_best_distance IS NULL OR v_distance < v_best_distance) THEN
        v_best_distance := v_distance;
        v_existing_id := v_candidate_id;
      END IF;
    END LOOP;
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
