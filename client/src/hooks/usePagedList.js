import { useEffect, useMemo, useState } from 'react';
import { LISTING_PAGE_SIZE } from '../constants/listings.js';

export function computePagerNums(pageCount, safePage) {
  if (pageCount <= 6) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const set = new Set([1, pageCount, safePage, safePage - 1, safePage + 1].filter((n) => n >= 1 && n <= pageCount));
  return [...set].sort((a, b) => a - b);
}

/**
 * @param {unknown[]} items — already sorted with newest / most relevant first
 * @param {{ pageSize?: number, resetKey?: string | number }} [options]
 */
export function usePagedList(items, options = {}) {
  const pageSize = options.pageSize ?? LISTING_PAGE_SIZE;
  const resetKey = options.resetKey ?? '';
  const [page, setPage] = useState(1);

  const list = Array.isArray(items) ? items : [];

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const safePage = Math.min(Math.max(1, page), pageCount);

  const pageSlice = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize]
  );

  const rangeFrom = total ? (safePage - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(safePage * pageSize, total);

  const pagerNums = useMemo(() => computePagerNums(pageCount, safePage), [pageCount, safePage]);

  return {
    page: safePage,
    setPage,
    pageSlice,
    pageCount,
    total,
    rangeFrom,
    rangeTo,
    pageSize,
    pagerNums,
    canPrev: safePage > 1,
    canNext: safePage < pageCount,
    goPrev: () => setPage((p) => Math.max(1, p - 1)),
    goNext: () => setPage((p) => Math.min(pageCount, p + 1)),
  };
}
