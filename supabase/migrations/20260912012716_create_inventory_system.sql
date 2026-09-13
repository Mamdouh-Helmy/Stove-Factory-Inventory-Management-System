/*
# Inventory Management System for Butane Gas Factory

## Overview
Creates a complete inventory management system with products, stock batches, and inventory transactions.
All critical calculations (weighted average cost, stock valuation, balance tracking) are performed
in PostgreSQL functions to prevent race conditions and ensure data integrity.

## Tables

### products
- `id` (uuid, primary key)
- `name` (text, not null) — product name
- `code` (text, unique) — optional product code
- `minimum_stock` (integer, default 5) — low stock threshold
- `current_quantity` (integer, default 0) — current total quantity (maintained by triggers/functions)
- `average_cost` (numeric, default 0) — weighted average unit cost
- `total_stock_value` (numeric, default 0) — total inventory value
- `last_unit_cost` (numeric, default 0) — most recent purchase unit cost
- `last_transaction_at` (timestamptz) — timestamp of last movement
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### stock_batches
- `id` (uuid, primary key)
- `product_id` (uuid, FK to products, ON DELETE CASCADE)
- `initial_quantity` (integer, not null) — original quantity received
- `remaining_quantity` (integer, not null) — quantity still in stock
- `unit_cost` (numeric, not null) — purchase price per unit
- `total_cost` (numeric, not null) — initial_quantity * unit_cost
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### inventory_transactions
- `id` (uuid, primary key)
- `product_id` (uuid, FK to products, ON DELETE CASCADE)
- `type` (text, not null) — 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT'
- `quantity` (integer, not null) — positive for IN, negative for OUT
- `unit_cost` (numeric, default 0) — unit cost at time of transaction
- `total_value` (numeric, default 0) — absolute value of the movement
- `reason` (text) — reason for movement (تصنيع/بيع/تالف/استخدام داخلي/أخرى)
- `notes` (text) — additional notes
- `reference` (text) — optional reference (e.g., invoice number)
- `balance_after` (integer, not null) — product quantity after this transaction
- `source` (text) — source of the stock out (optional)
- `created_by` (text) — user who performed the action
- `created_at` (timestamptz, default now())

## Functions

### add_stock(p_product_id, p_quantity, p_unit_cost, p_notes, p_reference, p_created_by)
Creates a new stock batch, updates product totals, creates STOCK_IN transaction.
If product doesn't exist (p_product_id is null), creates a new product first.
Returns the product record.

### stock_out(p_product_id, p_quantity, p_reason, p_notes, p_source, p_created_by)
Validates sufficient stock, computes weighted average cost for the withdrawal,
updates product totals, creates STOCK_OUT transaction.
Prevents negative stock via row-level locking.

### update_product(p_product_id, p_name, p_code, p_minimum_stock)
Updates editable product fields without touching inventory data.

### get_product_summary(p_date_from, p_date_to)
Returns aggregated stats for dashboard cards.

## Security
- RLS enabled on all tables.
- All tables allow anon + authenticated CRUD (single-tenant, no auth app).
- Critical mutations go through SECURITY DEFINER functions that bypass RLS safely.
*/

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  minimum_stock integer NOT NULL DEFAULT 5,
  current_quantity integer NOT NULL DEFAULT 0,
  average_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_stock_value numeric(14,2) NOT NULL DEFAULT 0,
  last_unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  last_transaction_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  initial_quantity integer NOT NULL,
  remaining_quantity integer NOT NULL,
  unit_cost numeric(14,2) NOT NULL,
  total_cost numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT')),
  quantity integer NOT NULL,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_value numeric(14,2) NOT NULL DEFAULT 0,
  reason text,
  notes text,
  reference text,
  balance_after integer NOT NULL,
  source text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Products: full CRUD for anon + authenticated (single-tenant)
DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- Stock batches: full CRUD
DROP POLICY IF EXISTS "anon_select_stock_batches" ON stock_batches;
CREATE POLICY "anon_select_stock_batches" ON stock_batches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_stock_batches" ON stock_batches;
CREATE POLICY "anon_insert_stock_batches" ON stock_batches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_stock_batches" ON stock_batches;
CREATE POLICY "anon_update_stock_batches" ON stock_batches FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_stock_batches" ON stock_batches;
CREATE POLICY "anon_delete_stock_batches" ON stock_batches FOR DELETE
  TO anon, authenticated USING (true);

-- Inventory transactions: full CRUD
DROP POLICY IF EXISTS "anon_select_inventory_transactions" ON inventory_transactions;
CREATE POLICY "anon_select_inventory_transactions" ON inventory_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_inventory_transactions" ON inventory_transactions;
CREATE POLICY "anon_insert_inventory_transactions" ON inventory_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_inventory_transactions" ON inventory_transactions;
CREATE POLICY "anon_update_inventory_transactions" ON inventory_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_inventory_transactions" ON inventory_transactions;
CREATE POLICY "anon_delete_inventory_transactions" ON inventory_transactions FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- add_stock: Creates a new batch, updates product totals, creates STOCK_IN transaction
CREATE OR REPLACE FUNCTION add_stock(
  p_product_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_notes text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_created_by text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_batch_id uuid;
  v_total_value numeric(14,2);
  v_new_total_value numeric(14,2);
  v_new_quantity integer;
  v_new_avg_cost numeric(14,2);
  v_transaction_id uuid;
BEGIN
  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;
  IF p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  -- Lock the product row to prevent race conditions
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Calculate new totals
  v_total_value := p_quantity * p_unit_cost;
  v_new_quantity := v_product.current_quantity + p_quantity;
  v_new_total_value := v_product.total_stock_value + v_total_value;

  IF v_new_quantity > 0 THEN
    v_new_avg_cost := ROUND(v_new_total_value / v_new_quantity, 2);
  ELSE
    v_new_avg_cost := 0;
  END IF;

  -- Create new stock batch
  INSERT INTO stock_batches (product_id, initial_quantity, remaining_quantity, unit_cost, total_cost)
  VALUES (p_product_id, p_quantity, p_quantity, p_unit_cost, v_total_value)
  RETURNING id INTO v_batch_id;

  -- Update product totals
  UPDATE products SET
    current_quantity = v_new_quantity,
    total_stock_value = v_new_total_value,
    average_cost = v_new_avg_cost,
    last_unit_cost = p_unit_cost,
    last_transaction_at = now(),
    updated_at = now()
  WHERE id = p_product_id;

  -- Create STOCK_IN transaction
  INSERT INTO inventory_transactions (
    product_id, type, quantity, unit_cost, total_value,
    notes, reference, balance_after, created_by
  )
  VALUES (
    p_product_id, 'STOCK_IN', p_quantity, p_unit_cost, v_total_value,
    p_notes, p_reference, v_new_quantity, p_created_by
  )
  RETURNING id INTO v_transaction_id;

  RETURN p_product_id;
END;
$$;

-- stock_out: Validates stock, computes weighted average cost, creates STOCK_OUT transaction
CREATE OR REPLACE FUNCTION stock_out(
  p_product_id uuid,
  p_quantity integer,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_created_by text DEFAULT NULL
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
  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  -- Lock the product row to prevent race conditions
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Check sufficient stock
  IF v_product.current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_product.current_quantity, p_quantity;
  END IF;

  -- Calculate weighted average cost for the withdrawal
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

  -- Update product totals
  UPDATE products SET
    current_quantity = v_new_quantity,
    total_stock_value = v_new_total_value,
    average_cost = v_new_avg_cost,
    last_transaction_at = now(),
    updated_at = now()
  WHERE id = p_product_id;

  -- Reduce remaining_quantity from batches proportionally (FIFO-like for batch tracking)
  -- We reduce from oldest batches first to keep batch remaining_quantity accurate
  -- But the COST is computed using weighted average, not FIFO
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

  -- Create STOCK_OUT transaction
  INSERT INTO inventory_transactions (
    product_id, type, quantity, unit_cost, total_value,
    reason, notes, balance_after, source, created_by
  )
  VALUES (
    p_product_id, 'STOCK_OUT', -p_quantity, v_out_unit_cost, v_out_value,
    p_reason, p_notes, v_new_quantity, p_source, p_created_by
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- create_product_with_stock: Creates a new product and its first stock entry in one atomic operation
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
  v_total_value numeric(14,2);
  v_avg_cost numeric(14,2);
BEGIN
  -- Validate
  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;
  IF p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  -- Create product
  INSERT INTO products (name, code, minimum_stock, current_quantity, total_stock_value, average_cost, last_unit_cost, last_transaction_at)
  VALUES (p_name, p_code, p_minimum_stock, 0, 0, 0, 0, CASE WHEN p_quantity > 0 THEN now() ELSE NULL END)
  RETURNING id INTO v_product_id;

  -- If there's initial stock, add it
  IF p_quantity > 0 THEN
    v_total_value := p_quantity * p_unit_cost;
    v_avg_cost := ROUND(v_total_value / p_quantity, 2);

    -- Create batch
    INSERT INTO stock_batches (product_id, initial_quantity, remaining_quantity, unit_cost, total_cost)
    VALUES (v_product_id, p_quantity, p_quantity, p_unit_cost, v_total_value);

    -- Update product
    UPDATE products SET
      current_quantity = p_quantity,
      total_stock_value = v_total_value,
      average_cost = v_avg_cost,
      last_unit_cost = p_unit_cost,
      updated_at = now()
    WHERE id = v_product_id;

    -- Create transaction
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

-- update_product: Updates editable fields only (not inventory data)
CREATE OR REPLACE FUNCTION update_product(
  p_product_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_minimum_stock integer DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products SET
    name = p_name,
    code = p_code,
    minimum_stock = p_minimum_stock,
    updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- get_dashboard_summary: Returns aggregated stats for dashboard cards
CREATE OR REPLACE FUNCTION get_dashboard_summary(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE(
  total_products bigint,
  total_quantity bigint,
  total_stock_value numeric,
  low_stock_count bigint,
  stock_in_today bigint,
  stock_out_today bigint,
  stock_in_value_today numeric,
  stock_out_value_today numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(current_quantity), 0)::bigint,
    COALESCE(SUM(total_stock_value), 0)::numeric,
    COUNT(*) FILTER (WHERE current_quantity <= minimum_stock AND current_quantity > 0)::bigint,
    COUNT(*) FILTER (WHERE type = 'STOCK_IN' AND created_at::date = now()::date)::bigint,
    COUNT(*) FILTER (WHERE type = 'STOCK_OUT' AND created_at::date = now()::date)::bigint,
    COALESCE(SUM(total_value) FILTER (WHERE type = 'STOCK_IN' AND created_at::date = now()::date), 0)::numeric,
    COALESCE(SUM(total_value) FILTER (WHERE type = 'STOCK_OUT' AND created_at::date = now()::date), 0)::numeric
  INTO
    total_products, total_quantity, total_stock_value, low_stock_count,
    stock_in_today, stock_out_today, stock_in_value_today, stock_out_value_today
  FROM products
  LEFT JOIN inventory_transactions ON inventory_transactions.product_id = products.id;

  RETURN NEXT;
END;
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_batches_updated_at ON stock_batches;
CREATE TRIGGER update_stock_batches_updated_at BEFORE UPDATE ON stock_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();