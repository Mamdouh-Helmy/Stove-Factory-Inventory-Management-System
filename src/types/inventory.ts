export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';

export interface Product {
  id: string;
  name: string;
  code: string | null;
  minimum_stock: number;
  current_quantity: number;
  average_cost: number;
  total_stock_value: number;
  last_unit_cost: number;
  last_transaction_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockBatch {
  id: string;
  product_id: string;
  initial_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  type: TransactionType;
  quantity: number;
  unit_cost: number;
  total_value: number;
  reason: string | null;
  notes: string | null;
  reference: string | null;
  balance_after: number;
  source: string | null;
  created_by: string | null;
  customer_id: string | null;
  created_at: string;
  products?: { name: string } | null;
  customers?: { name: string; phone: string; address?: string | null } | null;
}

export interface DashboardSummary {
  total_products: number;
  total_quantity: number;
  total_stock_value: number;
  low_stock_count: number;
  stock_in_today: number;
  stock_out_today: number;
  stock_in_value_today: number;
  stock_out_value_today: number;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export function getStockStatus(product: Product): StockStatus {
  if (product.current_quantity === 0) return 'out_of_stock';
  if (product.current_quantity <= product.minimum_stock) return 'low_stock';
  return 'in_stock';
}


export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}