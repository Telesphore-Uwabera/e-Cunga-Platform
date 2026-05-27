/** Shared date windows and ISO checks for dashboard / report filtering. */

export function getPeriodBounds(period) {
  const end = Date.now();
  let days = 30;
  if (period === '1d') days = 1;
  else if (period === '7d') days = 7;
  else if (period === '30d') days = 30;
  else if (period === '90d') days = 90;
  else if (period === 'year') days = 365;
  if (period === 'custom') return null;
  return { start: end - days * 86400000, end };
}

/** @param {string} preset 'all' | '1d' | '7d' | '30d' | '90d' | 'year' */
export function getAdminDateBounds(preset) {
  if (preset === 'all' || preset === 'custom') return null;
  const end = Date.now();
  const days = preset === '1d' ? 1 : preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
  return { start: end - days * 86400000, end };
}

export function isoInRange(iso, start, end) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start && t <= end;
}

export function isoInBounds(iso, bounds) {
  if (!bounds) return true;
  return isoInRange(iso, bounds.start, bounds.end);
}

/** Clerk analytics: 7 | 30 | 90 days */
export function getClerkRangeBounds(rangeKey) {
  if (rangeKey === 'all') return null;
  const end = Date.now();
  const days = rangeKey === '7' ? 7 : rangeKey === '90' ? 90 : 30;
  return { start: end - days * 86400000, end };
}
