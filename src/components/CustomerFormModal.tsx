import { useState, useEffect } from 'react';
import Modal from './Modal';
import { createCustomer, updateCustomer } from '@/lib/api';
import type { Customer } from '@/types/inventory';

interface Props {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CustomerFormModal({ customer, open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(customer?.name || '');
      setPhone(customer?.phone || '');
      setAddress(customer?.address || '');
      setNotes(customer?.notes || '');
      setError(null);
    }
  }, [open, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('اسم العميل مطلوب'); return; }
    if (!phone.trim()) { setError('رقم التليفون مطلوب'); return; }

    setLoading(true);
    try {
      if (customer) {
        await updateCustomer({
          id: customer.id,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم العميل *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم التليفون *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">العنوان</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات (اختياري)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'جاري الحفظ...' : customer ? 'حفظ التعديلات' : 'إضافة العميل'}
          </button>
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}