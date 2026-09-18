import { useEffect, useMemo, useState } from 'react';

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // لو الصفحة الحالية بقت أكبر من عدد الصفحات (بعد حذف/فلترة)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize: changePageSize,
    total: items.length,
  };
}