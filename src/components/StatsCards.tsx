import { Package, Boxes, Wallet, AlertTriangle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import type { DashboardSummary } from '@/types/inventory';
import { formatCurrency, formatNumber } from '@/lib/format';

interface Props {
  summary: DashboardSummary | null;
  loading: boolean;
}

function Card({ icon, label, value, sublabel, colorClass }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-800 truncate">{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function StatsCards({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card
        icon={<Package className="w-6 h-6 text-blue-600" />}
        label="إجمالي المنتجات"
        value={formatNumber(summary.total_products)}
        colorClass="bg-blue-50"
      />
      <Card
        icon={<Boxes className="w-6 h-6 text-teal-600" />}
        label="إجمالي الكمية"
        value={formatNumber(summary.total_quantity)}
        colorClass="bg-teal-50"
      />
      <Card
        icon={<Wallet className="w-6 h-6 text-emerald-600" />}
        label="قيمة المخزون"
        value={formatCurrency(summary.total_stock_value)}
        colorClass="bg-emerald-50"
      />
      <Card
        icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
        label="مخزون منخفض"
        value={formatNumber(summary.low_stock_count)}
        colorClass="bg-amber-50"
      />
      <Card
        icon={<ArrowDownCircle className="w-6 h-6 text-green-600" />}
        label="إدخال اليوم"
        value={formatNumber(summary.stock_in_today)}
        sublabel={formatCurrency(summary.stock_in_value_today)}
        colorClass="bg-green-50"
      />
      <Card
        icon={<ArrowUpCircle className="w-6 h-6 text-rose-600" />}
        label="سحب اليوم"
        value={formatNumber(summary.stock_out_today)}
        sublabel={formatCurrency(summary.stock_out_value_today)}
        colorClass="bg-rose-50"
      />
    </div>
  );
}
