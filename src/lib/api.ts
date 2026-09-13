import { supabase } from './supabase';
import type { Product, StockBatch, InventoryTransaction, DashboardSummary } from '@/types/inventory';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchBatches(productId: string): Promise<StockBatch[]> {
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTransactions(productId: string): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('get_dashboard_summary');
  if (error) throw error;
  return data as unknown as DashboardSummary;
}

export async function createProductWithStock(params: {
  name: string;
  code?: string;
  quantity: number;
  unitCost: number;
  minimumStock: number;
  notes?: string;
  createdBy?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_product_with_stock', {
    p_name: params.name,
    p_code: params.code || null,
    p_quantity: params.quantity,
    p_unit_cost: params.unitCost,
    p_minimum_stock: params.minimumStock,
    p_notes: params.notes || null,
    p_created_by: params.createdBy || null,
  });
  if (error) throw error;
  return data;
}

export async function findExistingProduct(name: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(10);
  if (error) return [];
  return data ?? [];
}

export async function addStock(params: {
  productId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
  reference?: string;
  createdBy?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('add_stock', {
    p_product_id: params.productId,
    p_quantity: params.quantity,
    p_unit_cost: params.unitCost,
    p_notes: params.notes || null,
    p_reference: params.reference || null,
    p_created_by: params.createdBy || null,
  });
  if (error) throw error;
  return data;
}

export async function stockOut(params: {
  productId: string;
  quantity: number;
  reason?: string;
  notes?: string;
  source?: string;
  createdBy?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('stock_out', {
    p_product_id: params.productId,
    p_quantity: params.quantity,
    p_reason: params.reason || null,
    p_notes: params.notes || null,
    p_source: params.source || null,
    p_created_by: params.createdBy || null,
  });
  if (error) throw error;
  return data;
}

export async function updateProduct(params: {
  productId: string;
  name: string;
  code?: string;
  minimumStock: number;
  lastUnitCost?: number | null;
  newQuantity?: number | null;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('update_product', {
    p_product_id: params.productId,
    p_name: params.name,
    p_code: params.code || null,
    p_minimum_stock: params.minimumStock,
    p_last_unit_cost: params.lastUnitCost ?? null,
    p_new_quantity: params.newQuantity ?? null,
    p_notes: params.notes || null,
  });
  if (error) throw error;
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

export async function fetchAllTransactions(): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*, products(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
