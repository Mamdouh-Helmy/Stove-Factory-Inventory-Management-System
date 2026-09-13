//supabase/migrations/20260912014612_fix_duplicate_products_and_edit_price.sql
/*

# Fix duplicate products and add price editing

## Problems
1. When a user adds a product with the same name as an existing one, the system
   creates a duplicate product instead of adding stock to the existing product.
   The create_product_with_stock function always INSERTs a new product row.

2. The update_product function only updates name, code, and minimum_stock.
   Users need to be able to edit the product's unit cost (last_unit_cost) too.

## Fixes

### create_product_with_stock
- Before inserting, check if a product with the same name (case-insensitive, trimmed) already exists.
- If found, add stock to the existing product (create a new batch, update totals, create transaction).
- If not found, create a new product as before.
- This prevents duplicate products while preserving the batch/transaction history.

### update_product
- Add p_last_unit_cost parameter (nullable).
- When provided (not null), update last_unit_cost on the product.
- Does NOT affect average_cost or batch history — only updates the displayed "last purchase price."

## Security
- No RLS changes. Functions remain SECURITY DEFINER with search_path = public.
*/

-- ============================================================
-- Fix create_product_with_stock: merge into existing product if same name
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
  v_total_value numeric(14,2);
  v_avg_cost numeric(14,2);
  v_new_quantity integer;
  v_new_total_value numeric(14,2);
BEGIN
  -- Validate
  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;
  IF p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  -- Check if a product with the same name already exists (case-insensitive, trimmed)
  SELECT id INTO v_existing_id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_name)) LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Product exists: add stock to it instead of creating a duplicate
    v_product_id := v_existing_id;

    IF p_quantity > 0 THEN
      v_total_value := p_quantity * p_unit_cost;

      -- Lock the product row
      SELECT current_quantity, total_stock_value INTO v_new_quantity, v_new_total_value
      FROM products WHERE id = v_product_id FOR UPDATE;

      v_new_quantity := v_new_quantity + p_quantity;
      v_new_total_value := v_new_total_value + v_total_value;
      v_avg_cost := ROUND(v_new_total_value / v_new_quantity, 2);

      -- Create new batch
      INSERT INTO stock_batches (product_id, initial_quantity, remaining_quantity, unit_cost, total_cost)
      VALUES (v_product_id, p_quantity, p_quantity, p_unit_cost, v_total_value);

      -- Update product totals
      UPDATE products SET
        current_quantity = v_new_quantity,
        total_stock_value = v_new_total_value,
        average_cost = v_avg_cost,
        last_unit_cost = p_unit_cost,
        last_transaction_at = now(),
        updated_at = now()
      WHERE id = v_product_id;

      -- Create STOCK_IN transaction
      INSERT INTO inventory_transactions (
        product_id, type, quantity, unit_cost, total_value,
        notes, balance_after, created_by
      )
      VALUES (
        v_product_id, 'STOCK_IN', p_quantity, p_unit_cost, v_total_value,
        p_notes, v_new_quantity, p_created_by
      );
    END IF;
  ELSE
    -- Product does not exist: create new product
    INSERT INTO products (name, code, minimum_stock, current_quantity, total_stock_value, average_cost, last_unit_cost, last_transaction_at)
    VALUES (p_name, p_code, p_minimum_stock, 0, 0, 0, 0, CASE WHEN p_quantity > 0 THEN now() ELSE NULL END)
    RETURNING id INTO v_product_id;

    IF p_quantity > 0 THEN
      v_total_value := p_quantity * p_unit_cost;
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
  END IF;

  RETURN v_product_id;
END;
$$;

-- ============================================================
-- Fix update_product: add optional last_unit_cost parameter
-- ============================================================

DROP FUNCTION IF EXISTS update_product(uuid, text, text, integer);

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
BEGIN
  IF p_last_unit_cost IS NOT NULL THEN
    UPDATE products SET
      name = p_name,
      code = p_code,
      minimum_stock = p_minimum_stock,
      last_unit_cost = p_last_unit_cost,
      updated_at = now()
    WHERE id = p_product_id;
  ELSE
    UPDATE products SET
      name = p_name,
      code = p_code,
      minimum_stock = p_minimum_stock,
      updated_at = now()
    WHERE id = p_product_id;
  END IF;
END;
$$;
