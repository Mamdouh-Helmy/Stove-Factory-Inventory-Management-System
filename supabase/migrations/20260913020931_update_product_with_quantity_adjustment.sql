/*
# Update update_product to support quantity adjustments and notes

## Problem
The edit modal needs to let the user adjust the product quantity (not just name/code/min_stock/price).
Changing the quantity should create an ADJUSTMENT transaction so the audit trail is preserved.

## Changes
- DROP and recreate update_product with two new params:
  - p_new_quantity (nullable integer): if provided and differs from current, creates an ADJUSTMENT transaction
  - p_notes (text): notes for the adjustment
- When p_new_quantity is provided:
  1. Lock the product row
  2. Compute the difference (new - current)
  3. Update product totals (quantity, stock value based on average_cost)
  4. Create an ADJUSTMENT transaction with the difference and balance_after
- All existing fields (name, code, minimum_stock, last_unit_cost) still work as before
- Name change still checks for duplicates via normalized_name + fuzzy match

## Security
- SECURITY DEFINER, search_path = public, no RLS changes
*/

DROP FUNCTION IF EXISTS update_product(uuid, text, text, integer, numeric);

CREATE FUNCTION update_product(
  p_product_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_minimum_stock integer DEFAULT 5,
  p_last_unit_cost numeric DEFAULT NULL,
  p_new_quantity integer DEFAULT NULL,
  p_notes text DEFAULT NULL
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
  v_current_quantity integer;
  v_current_avg_cost numeric(14,2);
  v_diff integer;
  v_adjustment_value numeric(14,2);
  v_new_total_value numeric(14,2);
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
  IF p_new_quantity IS NOT NULL AND p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;

  v_normalized_name := normalize_product_name(p_name);
  PERFORM pg_advisory_xact_lock(hashtext(v_normalized_name));

  -- Check for duplicate name (exact or fuzzy)
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

  -- Handle quantity adjustment if requested
  IF p_new_quantity IS NOT NULL THEN
    SELECT current_quantity, average_cost INTO v_current_quantity, v_current_avg_cost
    FROM products WHERE id = p_product_id FOR UPDATE;

    v_diff := p_new_quantity - v_current_quantity;

    IF v_diff <> 0 THEN
      v_adjustment_value := ROUND(ABS(v_diff) * v_current_avg_cost, 2);

      IF v_diff > 0 THEN
        -- Positive adjustment: increase stock
        v_new_total_value := (SELECT total_stock_value FROM products WHERE id = p_product_id) + v_adjustment_value;
        UPDATE products SET
          current_quantity = p_new_quantity,
          total_stock_value = v_new_total_value,
          average_cost = ROUND(v_new_total_value / p_new_quantity, 2),
          last_transaction_at = now()
        WHERE id = p_product_id;

        INSERT INTO inventory_transactions (
          product_id, type, quantity, unit_cost, total_value,
          notes, balance_after
        )
        VALUES (
          p_product_id, 'ADJUSTMENT', v_diff, v_current_avg_cost, v_adjustment_value,
          p_notes, p_new_quantity
        );
      ELSE
        -- Negative adjustment: decrease stock
        v_new_total_value := GREATEST(0, (SELECT total_stock_value FROM products WHERE id = p_product_id) - v_adjustment_value);
        UPDATE products SET
          current_quantity = p_new_quantity,
          total_stock_value = v_new_total_value,
          average_cost = CASE WHEN p_new_quantity > 0 THEN ROUND(v_new_total_value / p_new_quantity, 2) ELSE 0 END,
          last_transaction_at = now()
        WHERE id = p_product_id;

        INSERT INTO inventory_transactions (
          product_id, type, quantity, unit_cost, total_value,
          notes, balance_after
        )
        VALUES (
          p_product_id, 'ADJUSTMENT', v_diff, v_current_avg_cost, v_adjustment_value,
          p_notes, p_new_quantity
        );
      END IF;
    END IF;
  END IF;

  -- Update basic product fields
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
