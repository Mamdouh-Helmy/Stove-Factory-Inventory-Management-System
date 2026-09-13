import type { Product, StockStatus } from '@/types/inventory';
import { getStockStatus } from '@/types/inventory';

const statusConfig: Record<StockStatus, { label: string; className: string; dot: string }> = {
  in_stock: { label: 'متوفر', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  low_stock: { label: 'مخزون منخفض', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  out_of_stock: { label: 'نفد المخزون', className: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

export default function StockBadge({ product }: { product: Product }) {
  const status = getStockStatus(product);
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
