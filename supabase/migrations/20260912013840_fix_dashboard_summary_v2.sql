//supabase/migrations/20260912013840_fix_dashboard_summary_v2.sql
/*

# Fix get_dashboard_summary — qualify all column references with table names

## Problem
PL/pgSQL output parameter names (total_stock_value, total_quantity, etc.) shadow
column names in subqueries, causing "column reference is ambiguous" errors.
The previous fix used subqueries but still didn't qualify column names inside them.

## Fix
Qualify every column reference with its table name prefix (products.column_name,
inventory_transactions.column_name) so PL/pgSQL can distinguish table columns
from output variables.
*/

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
DECLARE
  v_total_products bigint;
  v_total_quantity bigint;
  v_total_stock_value numeric;
  v_low_stock_count bigint;
  v_stock_in_today bigint;
  v_stock_out_today bigint;
  v_stock_in_value_today numeric;
  v_stock_out_value_today numeric;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM products),
    (SELECT COALESCE(SUM(products.current_quantity), 0) FROM products),
    (SELECT COALESCE(SUM(products.total_stock_value), 0) FROM products),
    (SELECT COUNT(*) FROM products WHERE products.current_quantity <= products.minimum_stock AND products.current_quantity > 0),
    (SELECT COUNT(*) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_IN' AND inventory_transactions.created_at::date = now()::date),
    (SELECT COUNT(*) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_OUT' AND inventory_transactions.created_at::date = now()::date),
    (SELECT COALESCE(SUM(inventory_transactions.total_value), 0) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_IN' AND inventory_transactions.created_at::date = now()::date),
    (SELECT COALESCE(SUM(inventory_transactions.total_value), 0) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_OUT' AND inventory_transactions.created_at::date = now()::date)
  INTO
    v_total_products, v_total_quantity, v_total_stock_value, v_low_stock_count,
    v_stock_in_today, v_stock_out_today, v_stock_in_value_today, v_stock_out_value_today;

  total_products := v_total_products;
  total_quantity := v_total_quantity;
  total_stock_value := v_total_stock_value;
  low_stock_count := v_low_stock_count;
  stock_in_today := v_stock_in_today;
  stock_out_today := v_stock_out_today;
  stock_in_value_today := v_stock_in_value_today;
  stock_out_value_today := v_stock_out_value_today;

  RETURN NEXT;
END;
$$;
