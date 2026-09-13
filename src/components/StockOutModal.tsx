import { useState } from 'react';
import Modal from './Modal';
import { stockOut } from '@/lib/api';
import type { Product } from '@/types/inventory';
import { formatNumber, formatCurrency } from '@/lib/format';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REASONS = ['تصنيع', 'بيع', 'تالف', 'استخدام داخلي', 'أخرى'];

export default function StockOutModal({ product, open, onClose, onSuccess }: Props) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setQuantity(''); setReason(''); setSource(''); setNotes(''); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { setError('الكمية يجب أن تكون رقم موجب'); return; }
    if (qty > product.current_quantity) {
      setError(`الكمية المطلوبة (${qty}) أكبر من المخزون المتاح (${product.current_quantity})`);
      return;
    }

    setLoading(true);
    try {
      await stockOut({
        productId: product.id,
        quantity: qty,
        reason: reason || undefined,
        source: source.trim() || undefined,
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
    <Modal open={open} onClose={onClose} title="سحب كمية من المخزون">
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
            <div className="flex items-center gap-4 mt-1.5">
              <p className="text-sm text-gray-500">الكمية الحالية: <span className="font-medium text-gray-700">{formatNumber(product.current_quantity)}</span></p>
              <p className="text-sm text-gray-500">متوسط التكلفة: <span className="font-medium text-gray-700">{formatCurrency(product.average_cost)}</span></p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية المطلوب سحبها *</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max={product.current_quantity}
              autoFocus
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">سبب السحب</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all text-gray-800 bg-white"
            >
              <option value="">— اختر السبب —</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">مصدر السحب (اختياري)</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="مثال: خط إنتاج 1"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all text-gray-800 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'جاري السحب...' : 'تأكيد السحب'}
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
