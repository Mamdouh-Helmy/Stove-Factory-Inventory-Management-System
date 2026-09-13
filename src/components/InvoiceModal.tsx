'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import type { InventoryTransaction } from '@/types/inventory';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format';
import logo from "../../public/ChatGPT Image Sep 13, 2026, 09_25_19 PM.png"

interface Props {
  transaction: InventoryTransaction | null;
  open: boolean;
  onClose: () => void;
}

export default function InvoiceModal({ transaction, open, onClose }: Props) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !transaction || !mounted) return null;

  const invoiceNumber = transaction.id.slice(0, 8).toUpperCase();
  const qty = Math.abs(transaction.quantity);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    if (!invoiceRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `فاتورة-${invoiceNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate invoice image:', err);
      alert('حدث خطأ أثناء تحميل الفاتورة كصورة');
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm no-print" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Toolbar — hidden when printing */}
        <div className="no-print flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-gray-800">فاتورة بيع #{invoiceNumber}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={downloading}
              title="تحميل كصورة"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{downloading ? 'جاري التحميل...' : 'تحميل صورة'}</span>
            </button>
            <button
              onClick={handlePrint}
              title="طباعة"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable / exportable invoice content */}
        <div className="overflow-y-auto">
          <div
            ref={invoiceRef}
            id="invoice-print-area"
            dir="rtl"
            className="bg-white p-6 sm:p-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-gray-800">
              <div className="flex items-center gap-3">
                <div>
                  
                  <img src={logo} alt="Logo" className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Aman Jaz</h1>
                  <p className="text-xs text-gray-500">فاتورة بيع</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500">رقم الفاتورة</p>
                <p className="text-sm font-bold text-gray-900" dir="ltr">{invoiceNumber}</p>
                <p className="text-xs text-gray-500 mt-1">{formatDateTime(transaction.created_at)}</p>
              </div>
            </div>

            {/* Customer info */}
            <div className="mt-5 bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">بيانات العميل</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">الاسم: </span>
                  <span className="font-medium text-gray-900">{transaction.customers?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">التليفون: </span>
                  <span className="font-medium text-gray-900" dir="ltr">{transaction.customers?.phone || '—'}</span>
                </div>
                {transaction.customers?.address && (
                  <div className="col-span-2">
                    <span className="text-gray-500">العنوان: </span>
                    <span className="font-medium text-gray-900">{transaction.customers.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items table */}
            <table className="w-full mt-5 border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-right py-2 text-xs font-semibold text-gray-600">الصنف</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-600">الكمية</th>
                  <th className="text-center py-2 text-xs font-semibold text-gray-600">سعر الوحدة</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-600">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-3 text-sm font-medium text-gray-900">{transaction.products?.name || '—'}</td>
                  <td className="py-3 text-sm text-gray-700 text-center">{formatNumber(qty)}</td>
                  <td className="py-3 text-sm text-gray-700 text-center">{formatCurrency(transaction.unit_cost)}</td>
                  <td className="py-3 text-sm font-medium text-gray-900 text-left">{formatCurrency(transaction.total_value)}</td>
                </tr>
              </tbody>
            </table>

            {/* Total */}
            <div className="mt-4 flex justify-end">
              <div className="w-full sm:w-56">
                <div className="flex items-center justify-between py-2 border-t-2 border-gray-800">
                  <span className="text-sm font-bold text-gray-900">الإجمالي</span>
                  <span className="text-base font-bold text-gray-900">{formatCurrency(transaction.total_value)}</span>
                </div>
              </div>
            </div>

            {(transaction.source || transaction.notes) && (
              <div className="mt-4 pt-3 border-t border-dashed border-gray-300 text-xs text-gray-500 space-y-1">
                {transaction.source && <p>المصدر: {transaction.source}</p>}
                {transaction.notes && <p>ملاحظات: {transaction.notes}</p>}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">شكرًا لتعاملكم معنا</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}