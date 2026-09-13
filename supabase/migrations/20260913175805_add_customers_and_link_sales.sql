/*
# Add customers and link sales to them

## What's new
- customers table: name (required), phone (required), address, notes,
  plus running totals (total_orders, total_spent, last_order_at) maintained
  automatically whenever a sale is linked to them.
- inventory_transactions.customer_id: nullable FK to customers. Only set
  when a STOCK_OUT is a sale to a specific customer — everything else
  (internal use, damaged, manufacturing) stays exactly as before.
- stock_out(): new optional p_customer_id param. When provided, the
  transaction is tagged with the customer and the customer's totals are
  updated in the same transaction (atomic, no partial state).

## Data safety
- Existing inventory_transactions rows are untouched (customer_id defaults NULL).
- No existing function behavior changes when p_customer_id is omitted.
*/

-- ============================================================
-- customers table
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  notes text,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric(14,2) NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Link inventory_transactions to customers
-- ============================================================

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_customer_id ON inventory_transactions(customer_id);

-- ============================================================
-- stock_out: add optional customer linking
-- ============================================================

DROP FUNCTION IF EXISTS stock_out(uuid, integer, text, text, text, text);

CREATE FUNCTION stock_out(
  p_product_id uuid,
  p_quantity integer,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_created_by text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_out_value numeric(14,2);
  v_new_quantity integer;
  v_new_total_value numeric(14,2);
  v_new_avg_cost numeric(14,2);
  v_out_unit_cost numeric(14,2);
  v_transaction_id uuid;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    PERFORM 1 FROM customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found';
    END IF;
  END IF;

  -- Lock the product row to prevent race conditions
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_product.current_quantity, p_quantity;
  END IF;

  IF v_product.current_quantity > 0 AND v_product.average_cost > 0 THEN
    v_out_unit_cost := v_product.average_cost;
  ELSE
    v_out_unit_cost := 0;
  END IF;

  v_out_value := ROUND(p_quantity * v_out_unit_cost, 2);
  v_new_quantity := v_product.current_quantity - p_quantity;
  v_new_total_value := v_product.total_stock_value - v_out_value;

  IF v_new_quantity > 0 THEN
    v_new_avg_cost := ROUND(v_new_total_value / v_new_quantity, 2);
  ELSE
    v_new_avg_cost := 0;
    v_new_total_value := 0;
  END IF;

  UPDATE products SET
    current_quantity = v_new_quantity,
    total_stock_value = v_new_total_value,
    average_cost = v_new_avg_cost,
    last_transaction_at = now(),
    updated_at = now()
  WHERE id = p_product_id;

  -- Reduce remaining_quantity from batches (oldest first) for batch-level tracking
  DECLARE
    v_remaining_to_reduce integer := p_quantity;
    v_batch record;
  BEGIN
    FOR v_batch IN
      SELECT id, remaining_quantity FROM stock_batches
      WHERE product_id = p_product_id AND remaining_quantity > 0
      ORDER BY created_at ASC
    LOOP
      IF v_remaining_to_reduce <= 0 THEN
        EXIT;
      END IF;
      IF v_batch.remaining_quantity <= v_remaining_to_reduce THEN
        UPDATE stock_batches SET remaining_quantity = 0, updated_at = now()
        WHERE id = v_batch.id;
        v_remaining_to_reduce := v_remaining_to_reduce - v_batch.remaining_quantity;
      ELSE
        UPDATE stock_batches SET remaining_quantity = remaining_quantity - v_remaining_to_reduce, updated_at = now()
        WHERE id = v_batch.id;
        v_remaining_to_reduce := 0;
      END IF;
    END LOOP;
  END;

  INSERT INTO inventory_transactions (
    product_id, type, quantity, unit_cost, total_value,
    reason, notes, balance_after, source, created_by, customer_id
  )
  VALUES (
    p_product_id, 'STOCK_OUT', -p_quantity, v_out_unit_cost, v_out_value,
    p_reason, p_notes, v_new_quantity, p_source, p_created_by, p_customer_id
  )
  RETURNING id INTO v_transaction_id;

  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_orders = total_orders + 1,
      total_spent = total_spent + v_out_value,
      last_order_at = now(),
      updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;