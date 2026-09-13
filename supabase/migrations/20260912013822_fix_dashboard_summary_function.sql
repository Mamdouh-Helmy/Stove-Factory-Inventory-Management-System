//supabase/migrations/20260912013822_fix_dashboard_summary_function.sql
/*
# Fix get_dashboard_summary function — ambiguous column references

## Problem
The get_dashboard_summary function uses a LEFT JOIN between products and inventory_transactions.
Columns like `total_stock_value`, `current_quantity`, `created_at`, `type`, and `total_value`
exist on both tables (or are ambiguous in the JOIN context), causing:
  ERROR: column reference "total_stock_value" is ambiguous

This caused Promise.all in the frontend to reject, so products never loaded.

## Fix
- Qualify all column references with their table name prefix.
- Use subqueries for product-level aggregates (count, sum of quantity, sum of stock value, low stock count)
  to avoid the JOIN inflating counts (since LEFT JOIN multiplies product rows by transaction rows).
- Use a separate subquery for transaction-level aggregates (stock in/out today).
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
BEGIN
  SELECT
    (SELECT COUNT(*) FROM products),
    (SELECT COALESCE(SUM(current_quantity), 0) FROM products),
    (SELECT COALESCE(SUM(total_stock_value), 0) FROM products),
    (SELECT COUNT(*) FROM products WHERE current_quantity <= minimum_stock AND current_quantity > 0),
    (SELECT COUNT(*) FROM inventory_transactions WHERE type = 'STOCK_IN' AND created_at::date = now()::date),
    (SELECT COUNT(*) FROM inventory_transactions WHERE type = 'STOCK_OUT' AND created_at::date = now()::date),
    (SELECT COALESCE(SUM(total_value), 0) FROM inventory_transactions WHERE type = 'STOCK_IN' AND created_at::date = now()::date),
    (SELECT COALESCE(SUM(total_value), 0) FROM inventory_transactions WHERE type = 'STOCK_OUT' AND created_at::date = now()::date)
  INTO
    total_products, total_quantity, total_stock_value, low_stock_count,
    stock_in_today, stock_out_today, stock_in_value_today, stock_out_value_today;

  RETURN NEXT;
END;
$$;
