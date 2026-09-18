import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, Phone, MapPin, Users, X } from 'lucide-react';
import type { Customer } from '@/types/inventory';
import { fetchCustomers, deleteCustomer } from '@/lib/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { usePagination } from '@/lib/usePagination';
import CustomerFormModal from './CustomerFormModal';
import Pagination from './Pagination';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, search]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 10);
  useEffect(() => { setPage(1); }, [search, setPage]);

  const handleEdit = (c: Customer) => { setSelected(c); setShowForm(true); };
  const handleAdd = () => { setSelected(null); setShowForm(true); };

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${c.name}"؟ لن يتم حذف الحركات السابقة، لكن سيتم فك ارتباطها بالعميل.`)) return;
    try {
      await deleteCustomer(c.id);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم التليفون..."
              className="w-full pr-11 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            إضافة عميل
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">لا يوجد عملاء</h3>
          <p className="text-sm text-gray-500">ابدأ بإضافة أول عميل</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">العميل</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">التليفون</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">العنوان</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">عدد الطلبات</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">إجمالي المشتريات</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">آخر طلب</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItems.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{c.name}</div>
                        {c.notes && <div className="text-xs text-gray-400 mt-0.5">{c.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" /> {c.phone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.address ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> {c.address}
                          </span>
                        ) : <span className="text-sm text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{formatNumber(c.total_orders)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">{formatCurrency(c.total_spent)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.last_order_at ? formatDate(c.last_order_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(c)} title="تعديل" className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(c)} title="حذف" className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <CustomerFormModal
        customer={selected}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadData}
      />
    </div>
  );
}