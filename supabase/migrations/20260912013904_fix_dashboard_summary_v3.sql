/*
# Simplify get_dashboard_summary to return JSON

## Problem
The RETURNS TABLE + RETURN NEXT pattern returns a composite type that may not
deserialize cleanly via the Supabase JS RPC client. Also, if the function errors,
Promise.all in the frontend rejects and products never load.

## Fix
- DROP the old function first (signature changed from RETURNS TABLE to RETURNS jsonb).
- Return a clean JSONB object with all dashboard stats.
- Use simple scalar subqueries with fully-qualified column names.
- Frontend will also be updated to fetch products and summary independently.
*/

DROP FUNCTION IF EXISTS get_dashboard_summary(timestamptz, timestamptz);

CREATE FUNCTION get_dashboard_summary(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_products', (SELECT COUNT(*) FROM products),
    'total_quantity', (SELECT COALESCE(SUM(products.current_quantity), 0) FROM products),
    'total_stock_value', (SELECT COALESCE(SUM(products.total_stock_value), 0) FROM products),
    'low_stock_count', (SELECT COUNT(*) FROM products WHERE products.current_quantity <= products.minimum_stock AND products.current_quantity > 0),
    'stock_in_today', (SELECT COUNT(*) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_IN' AND inventory_transactions.created_at::date = now()::date),
    'stock_out_today', (SELECT COUNT(*) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_OUT' AND inventory_transactions.created_at::date = now()::date),
    'stock_in_value_today', (SELECT COALESCE(SUM(inventory_transactions.total_value), 0) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_IN' AND inventory_transactions.created_at::date = now()::date),
    'stock_out_value_today', (SELECT COALESCE(SUM(inventory_transactions.total_value), 0) FROM inventory_transactions WHERE inventory_transactions.type = 'STOCK_OUT' AND inventory_transactions.created_at::date = now()::date)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
