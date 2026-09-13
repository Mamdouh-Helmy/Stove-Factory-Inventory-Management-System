import { Plus, Minus, Eye, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import type { Product } from '@/types/inventory';
import { getStockStatus } from '@/types/inventory';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format';
import StockBadge from './StockBadge';

interface Props {
  products: Product[];
  loading: boolean;
  onAddStock: (product: Product) => void;
  onStockOut: (product: Product) => void;
  onDetails: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export default function ProductTable({ products, loading, onAddStock, onStockOut, onDetails, onEdit, onDelete }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-200 animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 border-b border-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowUpDown className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">لا توجد منتجات</h3>
        <p className="text-sm text-gray-500">ابدأ بإضافة منتج جديد لإدارة مخزونك</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">المنتج</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">الكود</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">الكمية</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">متوسط التكلفة</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">آخر سعر شراء</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">قيمة المخزون</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">آخر حركة</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">الحالة</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product) => {
              const status = getStockStatus(product);
              return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{product.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500 font-mono">{product.code || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${status === 'out_of_stock' ? 'text-rose-600' : status === 'low_stock' ? 'text-amber-600' : 'text-gray-800'}`}>
                      {formatNumber(product.current_quantity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(product.average_cost)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(product.last_unit_cost)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">{formatCurrency(product.total_stock_value)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {product.last_transaction_at ? formatDateTime(product.last_transaction_at) : '—'}
                  </td>
                  <td className="px-4 py-3"><StockBadge product={product} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onAddStock(product)}
                        title="إضافة كمية"
                        className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onStockOut(product)}
                        title="سحب كمية"
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDetails(product)}
                        title="تفاصيل"
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(product)}
                        title="تعديل"
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(product)}
                        title="حذف"
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
