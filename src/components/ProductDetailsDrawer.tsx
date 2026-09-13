import { useEffect, useState } from 'react';
import { X, Package, Boxes, Wallet, TrendingUp, Layers, Clock, ArrowDownCircle, ArrowUpCircle, User } from 'lucide-react';
import type { Product, StockBatch, InventoryTransaction } from '@/types/inventory';
import { fetchBatches, fetchTransactions } from '@/lib/api';
import { formatCurrency, formatNumber, formatDateTime, formatDate } from '@/lib/format';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

type Tab = 'overview' | 'batches' | 'transactions' | 'timeline';

export default function ProductDetailsDrawer({ product, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setLoading(true);
      Promise.all([
        fetchBatches(product.id),
        fetchTransactions(product.id),
      ]).then(([b, t]) => {
        setBatches(b);
        setTransactions(t);
      }).finally(() => setLoading(false));
    }
  }, [open, product]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open || !product) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'معلومات', icon: <Package className="w-4 h-4" /> },
    { id: 'batches', label: 'التشغيلات', icon: <Layers className="w-4 h-4" /> },
    { id: 'transactions', label: 'الحركات', icon: <Clock className="w-4 h-4" /> },
    { id: 'timeline', label: 'الخط الزمني', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-50 w-full sm:max-w-2xl h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 truncate">{product.name}</h2>
            <p className="text-xs sm:text-sm text-gray-500">{product.code ? `كود: ${product.code}` : 'بدون كود'}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-teal-50 rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0" />
                <span className="text-[11px] sm:text-xs text-teal-600 font-medium truncate">الكمية</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-gray-800">{formatNumber(product.current_quantity)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                <span className="text-[11px] sm:text-xs text-blue-600 font-medium truncate">متوسط التكلفة</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-gray-800 truncate">{formatCurrency(product.average_cost)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] sm:text-xs text-emerald-600 font-medium truncate">قيمة المخزون</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-gray-800 truncate">{formatCurrency(product.total_stock_value)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
                <span className="text-[11px] sm:text-xs text-purple-600 font-medium truncate">آخر سعر</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-gray-800 truncate">{formatCurrency(product.last_unit_cost)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-2 sm:px-6 flex gap-0.5 sm:gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                    <h3 className="font-semibold text-gray-800 mb-3">معلومات المنتج</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">الاسم: </span><span className="font-medium text-gray-800">{product.name}</span></div>
                      <div><span className="text-gray-500">الكود: </span><span className="font-medium text-gray-800">{product.code || '—'}</span></div>
                      <div><span className="text-gray-500">حد المخزون المنخفض: </span><span className="font-medium text-gray-800">{product.minimum_stock}</span></div>
                      <div><span className="text-gray-500">تاريخ الإضافة: </span><span className="font-medium text-gray-800">{formatDate(product.created_at)}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'batches' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">التاريخ</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">الكمية الأصلية</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">المتبقي</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">سعر الوحدة</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {batches.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">لا توجد تشغيلات</td></tr>
                        ) : batches.map((batch) => (
                          <tr key={batch.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(batch.created_at)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatNumber(batch.initial_quantity)}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={batch.remaining_quantity === 0 ? 'text-gray-400' : 'font-medium text-gray-800'}>
                                {formatNumber(batch.remaining_quantity)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatCurrency(batch.unit_cost)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatCurrency(batch.total_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'transactions' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">التاريخ والوقت</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">النوع</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">الكمية</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">سعر الوحدة</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">القيمة</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">الرصيد</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">السبب</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">العميل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">لا توجد حركات</td></tr>
                        ) : transactions.map((txn) => (
                          <tr key={txn.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDateTime(txn.created_at)}</td>
                            <td className="px-4 py-3">
                              {txn.type === 'STOCK_IN' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <ArrowDownCircle className="w-3.5 h-3.5" /> إدخال
                                </span>
                              ) : txn.type === 'STOCK_OUT' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  <ArrowUpCircle className="w-3.5 h-3.5" /> سحب
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  تعديل
                                </span>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${txn.quantity > 0 ? 'text-green-600' : 'text-rose-600'}`}>
                              {txn.quantity > 0 ? '+' : ''}{formatNumber(txn.quantity)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatCurrency(txn.unit_cost)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatCurrency(txn.total_value)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatNumber(txn.balance_after)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{txn.reason || '—'}</td>
                            <td className="px-4 py-3 text-sm">
                              {txn.customers ? (
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-800 whitespace-nowrap">{txn.customers.name}</span>
                                  <span className="text-xs text-gray-400 whitespace-nowrap">{txn.customers.phone}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'timeline' && (
                <div className="space-y-3">
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">لا توجد حركات</div>
                  ) : transactions.map((txn) => (
                    <div key={txn.id} className="bg-white rounded-xl border border-gray-200 p-3.5 sm:p-4 flex gap-3">
                      <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                        txn.type === 'STOCK_IN' ? 'bg-green-50' : txn.type === 'STOCK_OUT' ? 'bg-rose-50' : 'bg-amber-50'
                      }`}>
                        {txn.type === 'STOCK_IN' ? (
                          <ArrowDownCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-green-600" />
                        ) : (
                          <ArrowUpCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-rose-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                          <div>
                            <span className={`text-sm font-medium ${txn.quantity > 0 ? 'text-green-600' : 'text-rose-600'}`}>
                              {txn.quantity > 0 ? '+' : ''}{formatNumber(txn.quantity)} وحدة
                            </span>
                            <span className="text-xs text-gray-400 mr-2">
                              {txn.type === 'STOCK_IN' ? 'إدخال مخزون' : txn.type === 'STOCK_OUT' ? 'سحب مخزون' : 'تعديل'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{formatDateTime(txn.created_at)}</span>
                        </div>

                        {txn.customers && (
                          <div className="mt-2 flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit">
                            <User className="w-3.5 h-3.5 shrink-0" />
                            <span>{txn.customers.name}</span>
                            <span className="text-blue-400">•</span>
                            <span dir="ltr">{txn.customers.phone}</span>
                          </div>
                        )}

                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-gray-400">سعر الوحدة: </span><span className="text-gray-600">{formatCurrency(txn.unit_cost)}</span></div>
                          <div><span className="text-gray-400">القيمة: </span><span className="text-gray-600">{formatCurrency(txn.total_value)}</span></div>
                          <div><span className="text-gray-400">الرصيد بعد: </span><span className="font-medium text-gray-700">{formatNumber(txn.balance_after)}</span></div>
                          <div><span className="text-gray-400">السبب: </span><span className="text-gray-600">{txn.reason || '—'}</span></div>
                          {txn.source && <div><span className="text-gray-400">المصدر: </span><span className="text-gray-600">{txn.source}</span></div>}
                          {txn.created_by && <div><span className="text-gray-400">المستخدم: </span><span className="text-gray-600">{txn.created_by}</span></div>}
                          {txn.notes && <div className="col-span-2"><span className="text-gray-400">ملاحظات: </span><span className="text-gray-600">{txn.notes}</span></div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}