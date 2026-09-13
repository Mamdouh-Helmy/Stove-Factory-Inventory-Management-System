import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { deleteProduct } from '@/lib/api';
import type { Product } from '@/types/inventory';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteConfirmModal({ product, open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!product) return;
    setError(null);
    setLoading(true);
    try {
      await deleteProduct(product.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="تأكيد الحذف">
      {product && (
        <div className="space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">هل أنت متأكد من حذف هذا المنتج؟</p>
              <p className="text-sm text-gray-500">
                سيتم حذف المنتج "<span className="font-medium">{product.name}</span>" وكل بيانات المخزون والحركات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'جاري الحذف...' : 'حذف نهائي'}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
