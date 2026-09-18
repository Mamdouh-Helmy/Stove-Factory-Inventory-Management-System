import { ChevronRight, ChevronLeft } from 'lucide-react';
import { formatNumber } from '@/lib/format';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

function getPages(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: Props) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const navBtn =
    'w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>
          عرض {formatNumber(from)}–{formatNumber(to)} من {formatNumber(total)}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>
                {formatNumber(s)} / صفحة
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* في RTL: السابق = يمين */}
        <button
          className={navBtn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="السابق"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {getPages(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`dots-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-9 h-9 px-2 rounded-lg text-sm font-medium border transition-colors ${
                p === page
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {formatNumber(p)}
            </button>
          )
        )}

        <button
          className={navBtn}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="التالي"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}