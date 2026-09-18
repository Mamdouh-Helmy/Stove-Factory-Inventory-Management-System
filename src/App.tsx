import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Filter, X, Users, BarChart3, Boxes } from 'lucide-react';
import type { Product, DashboardSummary } from '@/types/inventory';
import { getStockStatus } from '@/types/inventory';
import { fetchProducts, fetchDashboardSummary } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { usePagination } from '@/lib/usePagination';
import StatsCards from '@/components/StatsCards';
import ProductTable from '@/components/ProductTable';
import Pagination from '@/components/Pagination';
import AddProductModal from '@/components/AddProductModal';
import AddStockModal from '@/components/AddStockModal';
import StockOutModal from '@/components/StockOutModal';
import EditProductModal from '@/components/EditProductModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import ProductDetailsDrawer from '@/components/ProductDetailsDrawer';
import CustomersPage from '@/components/CustomersPage';
import ReportsPage from '@/components/ReportsPage';
import logo from "../public/ChatGPT Image Sep 13, 2026, 09_25_19 PM.png"

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type View = 'inventory' | 'customers' | 'reports';

export default function App() {
  const [view, setView] = useState<View>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadData = useCallback(async () => {
    try {
      const prods = await fetchProducts();
      setProducts(prods);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
    try {
      const summ = await fetchDashboardSummary();
      setSummary(summ);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
      );
    }
    if (stockFilter !== 'all') {
      result = result.filter((p) => getStockStatus(p) === stockFilter);
    }
    return result;
  }, [products, search, stockFilter]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filteredProducts, 10);

  // ارجع لأول صفحة لما البحث أو الفلتر يتغير
  useEffect(() => { setPage(1); }, [search, stockFilter, setPage]);

  const filteredTotalValue = useMemo(
    () => filteredProducts.reduce((sum, p) => sum + (p.total_stock_value || 0), 0),
    [filteredProducts]
  );

  const handleAddStock = (product: Product) => { setSelectedProduct(product); setShowAddStock(true); };
  const handleStockOut = (product: Product) => { setSelectedProduct(product); setShowStockOut(true); };
  const handleDetails = (product: Product) => { setSelectedProduct(product); setShowDetails(true); };
  const handleEdit = (product: Product) => { setSelectedProduct(product); setShowEdit(true); };
  const handleDelete = (product: Product) => { setSelectedProduct(product); setShowDelete(true); };

  const filterButtons: { id: StockFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'in_stock', label: 'متوفر' },
    { id: 'low_stock', label: 'منخفض' },
    { id: 'out_of_stock', label: 'نفد' },
  ];

  const navTabs: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: 'inventory', label: 'المخزون', icon: <Boxes className="w-4 h-4" /> },
    { id: 'customers', label: 'العملاء', icon: <Users className="w-4 h-4" /> },
    { id: 'reports', label: 'التقارير', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div>
                <img src={logo} alt="Logo" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Aman Jaz</h1>
                <p className="text-xs text-gray-500">نظام إدارة المخزون</p>
              </div>
            </div>
            {view === 'inventory' && (
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">إضافة منتج</span>
              </button>
            )}
          </div>
          <div className="flex gap-1 -mb-px">
            {navTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  view === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {view === 'inventory' && (
          <>
            <StatsCards summary={summary} loading={loading} />

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو الكود..."
                    className="w-full pr-11 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex gap-1.5 flex-wrap">
                    {filterButtons.map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setStockFilter(btn.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          stockFilter === btn.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <ProductTable
              products={pageItems}
              loading={loading}
              onAddStock={handleAddStock}
              onStockOut={handleStockOut}
              onDetails={handleDetails}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

            {!loading && total > 0 && (
              <>
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
                <div className="text-sm text-gray-500 px-1">
                  إجمالي قيمة المخزون المعروض: <span className="font-semibold text-gray-700">{formatCurrency(filteredTotalValue)}</span>
                </div>
              </>
            )}
          </>
        )}

        {view === 'customers' && <CustomersPage />}
        {view === 'reports' && <ReportsPage />}
      </main>

      <AddProductModal open={showAddProduct} onClose={() => setShowAddProduct(false)} onSuccess={loadData} />
      <AddStockModal product={selectedProduct} open={showAddStock} onClose={() => setShowAddStock(false)} onSuccess={loadData} />
      <StockOutModal product={selectedProduct} open={showStockOut} onClose={() => setShowStockOut(false)} onSuccess={loadData} />
      <EditProductModal product={selectedProduct} open={showEdit} onClose={() => setShowEdit(false)} onSuccess={loadData} />
      <DeleteConfirmModal product={selectedProduct} open={showDelete} onClose={() => setShowDelete(false)} onSuccess={loadData} />
      <ProductDetailsDrawer product={selectedProduct} open={showDetails} onClose={() => setShowDetails(false)} />
    </div>
  );
}