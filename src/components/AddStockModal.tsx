import { useState } from 'react';
import Modal from './Modal';
import { addStock } from '@/lib/api';
import type { Product } from '@/types/inventory';
import { formatNumber } from '@/lib/format';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStockModal({ product, open, onClose, onSuccess }: Props) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setQuantity(''); setUnitCost(''); setNotes(''); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);
    const qty = parseInt(quantity);
    const cost = parseFloat(unitCost);
    if (!qty || qty <= 0) { setError('الكمية يجب أن تكون رقم موجب'); return; }
    if (isNaN(cost) || cost < 0) { setError('السعر يجب أن يكون رقم صحيح'); return; }

    setLoading(true);
    try {
      await addStock({
        productId: product.id,
        quantity: qty,
        unitCost: cost,
        notes: notes.trim() || undefined,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة كمية للمخزون">
      {product && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
            <p className="text-sm text-gray-500">المنتج</p>
            <p className="font-semibold text-gray-800">{product.name}</p>
            <p className="text-sm text-gray-500 mt-1">الكمية الحالية: <span className="font-medium text-gray-700">{formatNumber(product.current_quantity)}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية *</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                autoFocus
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">سعر الوحدة (ج.م) *</label>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-gray-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-gray-800 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'جاري الإضافة...' : 'إضافة للمخزون'}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
