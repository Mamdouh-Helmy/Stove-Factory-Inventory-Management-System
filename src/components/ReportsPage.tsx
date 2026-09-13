import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Users, Wallet, Package, Receipt, User } from 'lucide-react';
import type { Customer, InventoryTransaction } from '@/types/inventory';
import { fetchCustomers, fetchCustomerSales } from '@/lib/api';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format';
import InvoiceModal from './InvoiceModal';

export default function ReportsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<InventoryTransaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const loadCustomers = useCallback(async () => {
    try { setCustomers(await fetchCustomers()); } catch (err) { console.error(err); }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerSales({
        customerId: customerId || undefined,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
      });
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales report:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId, dateFrom, dateTo]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadSales(); }, [loadSales]);

  const summary = useMemo(() => {
    const totalValue = sales.reduce((sum, t) => sum + t.total_value, 0);
    const totalQty = sales.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
    const uniqueCustomers = new Set(sales.map((t) => t.customer_id)).size;
    return { totalValue, totalQty, uniqueCustomers, count: sales.length };
  }, [sales]);

  const openInvoice = (t: InventoryTransaction) => { setSelectedSale(t); setShowInvoice(true); };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">العميل</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 sm:px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm text-gray-800 bg-white"
            >
              <option value="">كل العملاء</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 sm:px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm text-gray-800"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 sm:px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm text-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">عدد عمليات البيع</p>
            <p className="text-sm sm:text-lg font-bold text-gray-800">{formatNumber(summary.count)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">إجمالي المبيعات</p>
            <p className="text-sm sm:text-lg font-bold text-gray-800 truncate">{formatCurrency(summary.totalValue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">إجمالي الكمية المباعة</p>
            <p className="text-sm sm:text-lg font-bold text-gray-800">{formatNumber(summary.totalQty)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">عدد العملاء</p>
            <p className="text-sm sm:text-lg font-bold text-gray-800">{formatNumber(summary.uniqueCustomers)}</p>
          </div>
        </div>
      </div>

      {/* Sales — table on desktop/tablet, cards on mobile */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 sm:p-12 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Receipt className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">لا توجد مبيعات لعملاء</h3>
          <p className="text-sm text-gray-500">في الفترة أو الفلتر المحدد</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-3">
            {sales.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{t.customers?.name || '—'}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{t.customers?.phone}</p>
                  </div>
                  <button
                    onClick={() => openInvoice(t)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    فاتورة
                  </button>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs">
                  <div><span className="text-gray-400">المنتج: </span><span className="text-gray-700 font-medium">{t.products?.name || '—'}</span></div>
                  <div><span className="text-gray-400">الكمية: </span><span className="text-rose-600 font-medium">{formatNumber(Math.abs(t.quantity))}</span></div>
                  <div><span className="text-gray-400">سعر الوحدة: </span><span className="text-gray-700">{formatCurrency(t.unit_cost)}</span></div>
                  <div><span className="text-gray-400">القيمة: </span><span className="text-gray-800 font-semibold">{formatCurrency(t.total_value)}</span></div>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">{formatDateTime(t.created_at)}</p>
              </div>
            ))}
          </div>

          {/* Tablet & desktop: table */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">التاريخ</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">العميل</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">المنتج</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">الكمية</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">سعر الوحدة</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">القيمة</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">فاتورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-800">{t.customers?.name || '—'}</div>
                        <div className="text-xs text-gray-400" dir="ltr">{t.customers?.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.products?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-rose-600">{formatNumber(Math.abs(t.quantity))}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatCurrency(t.unit_cost)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{formatCurrency(t.total_value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            onClick={() => openInvoice(t)}
                            title="عرض / طباعة الفاتورة"
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <InvoiceModal
        transaction={selectedSale}
        open={showInvoice}
        onClose={() => setShowInvoice(false)}
      />
    </div>
  );
}