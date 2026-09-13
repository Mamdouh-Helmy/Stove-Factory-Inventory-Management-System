import { useState, useEffect, useRef } from 'react';
import {  Check } from 'lucide-react';
import Modal from './Modal';
import { createProductWithStock, searchProducts } from '@/lib/api';
import type { Product } from '@/types/inventory';
import { formatNumber } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProductModal({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [minimumStock, setMinimumStock] = useState('5');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(''); setCode(''); setQuantity(''); setUnitCost(''); setMinimumStock('5'); setNotes('');
    setError(null); setSuggestions([]); setSelectedProduct(null); setShowSuggestions(false);
  };

  useEffect(() => {
    if (open) {
      reset();
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!name.trim() || name.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedProduct(null);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchProducts(name.trim());
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 250);
    return () => clearTimeout(timer);
  }, [name]);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setName(p.name);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('اسم المنتج مطلوب'); return; }
    const qty = parseInt(quantity) || 0;
    const cost = parseFloat(unitCost) || 0;
    if (qty < 0) { setError('الكمية لا يمكن أن تكون سالبة'); return; }
    if (cost < 0) { setError('السعر لا يمكن أن يكون سالب'); return; }

    setLoading(true);
    try {
      await createProductWithStock({
        name: name.trim(),
        code: selectedProduct ? undefined : (code.trim() || undefined),
        quantity: qty,
        unitCost: cost,
        minimumStock: selectedProduct ? selectedProduct.minimum_stock : (parseInt(minimumStock) || 5),
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
    <Modal open={open} onClose={onClose} title={selectedProduct ? 'إضافة كمية لمنتج موجود' : 'إضافة منتج جديد'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        {/* Product name with autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المنتج *</label>
          <div className="relative">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSelectedProduct(null); }}
              placeholder="مثال: بوتجاز 5 شعلة"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
            {selectedProduct && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                <Check className="w-4 h-4" /> موجود
              </span>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && !selectedProduct && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              <p className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100">منتجات موجودة — اختر لإضافة كمية</p>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className="w-full text-right px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                    <span className="text-xs text-gray-500">الكمية: {formatNumber(p.current_quantity)}</span>
                  </div>
                  {p.code && <span className="text-xs text-gray-400">كود: {p.code}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info box when existing product selected */}
        {selectedProduct && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-700 font-medium">{selectedProduct.name}</p>
            <p className="text-xs text-blue-600 mt-1">
              الكمية الحالية: {formatNumber(selectedProduct.current_quantity)} — سيتم إضافة الكمية كتشغيلة (Batch) جديدة على نفس المنتج.
            </p>
          </div>
        )}

        {/* Code & minimum stock — only for new products */}
        {!selectedProduct && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كود المنتج (اختياري)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثال: BG-001"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
              />
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
          </>
        )}

        {/* Quantity & price — always shown */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="ملاحظات اختيارية..."
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'جاري الإضافة...' : selectedProduct ? 'إضافة الكمية' : 'إضافة المنتج'}
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
    </Modal>
  );
}
