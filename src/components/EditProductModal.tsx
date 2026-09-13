import { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { updateProduct } from '@/lib/api';
import type { Product } from '@/types/inventory';
import { formatNumber, formatCurrency } from '@/lib/format';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProductModal({ product, open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [minimumStock, setMinimumStock] = useState('5');
  const [unitCost, setUnitCost] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastProductRef = useRef<string | null>(null);

  useEffect(() => {
    if (product && product.id !== lastProductRef.current) {
      lastProductRef.current = product.id;
      setName(product.name);
      setCode(product.code || '');
      setMinimumStock(String(product.minimum_stock));
      setUnitCost(String(product.last_unit_cost || ''));
      setQuantity(String(product.current_quantity));
      setNotes('');
      setError(null);
    }
    if (!product) lastProductRef.current = null;
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);
    if (!name.trim()) { setError('اسم المنتج مطلوب'); return; }

    const newQty = parseInt(quantity);
    const cost = unitCost.trim() ? parseFloat(unitCost) : null;
    const qtyChanged = !isNaN(newQty) && newQty !== product.current_quantity;

    if (!isNaN(newQty) && newQty < 0) { setError('الكمية لا يمكن أن تكون سالبة'); return; }
    if (cost !== null && cost < 0) { setError('السعر لا يمكن أن يكون سالب'); return; }

    setLoading(true);
    try {
      await updateProduct({
        productId: product.id,
        name: name.trim(),
        code: code.trim() || undefined,
        minimumStock: parseInt(minimumStock) || 5,
        lastUnitCost: cost,
        newQuantity: qtyChanged ? newQty : null,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const qtyChanged = quantity !== '' && product && parseInt(quantity) !== product.current_quantity;

  return (
    <Modal open={open} onClose={onClose} title="تعديل المنتج">
      {product && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Product info summary */}
          <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">المنتج الحالي</p>
              <p className="text-xs text-gray-400">الكمية الحالية: {formatNumber(product.current_quantity)}</p>
            </div>
            <p className="font-semibold text-gray-800">{product.name}</p>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
              <span>متوسط التكلفة: {formatCurrency(product.average_cost)}</span>
              <span>قيمة المخزون: {formatCurrency(product.total_stock_value)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المنتج *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">كود المنتج</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="بدون كود"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                className={`w-full px-3.5 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all text-gray-800 ${
                  qtyChanged
                    ? 'border-amber-400 focus:ring-amber-500 bg-amber-50'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {qtyChanged && (
                <p className="text-xs text-amber-600 mt-1">
                  سيتم تسجيل تعديل الكمية كحركة تعديل (Adjustment)
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">سعر الوحدة (ج.م)</label>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">حد المخزون المنخفض</label>
            <input
              type="number"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              min="0"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="ملاحظات عن التعديل (اختياري)..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 resize-none"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-amber-700 text-xs">
            تعديل بيانات المنتج لا يحذف الحركات السابقة. تغيير الكمية يُسجل كحركة تعديل في السجل التاريخي.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
