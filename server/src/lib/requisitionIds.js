import Requisition from '../models/Requisition.js';

/** e.g. "Apr2026" — human-readable month bucket for IDs. */
export function requisitionMonthTag(date = new Date()) {
  return new Date(date).toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(/\s/g, '');
}

/** Prefix: Req-Manu-Apr2026- or Req-Auto-Apr2026- */
export function buildRequisitionIdPrefix(kind, date = new Date()) {
  const mid = kind === 'auto' ? 'Auto' : 'Manu';
  return `Req-${mid}-${requisitionMonthTag(date)}-`;
}

/**
 * Next sequential id per company, kind (manu | auto), and calendar month of `date`.
 * Format: Req-Manu-Apr2026-0001 / Req-Auto-Apr2026-0001
 */
export async function allocateRequisitionId(companyId, kind, date = new Date()) {
  const prefix = buildRequisitionIdPrefix(kind, date);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixRe = new RegExp(`^${escaped}(\\d{4})$`);
  const existing = await Requisition.find({
    _id: new RegExp(`^${escaped}\\d{4}$`),
  })
    .select('_id')
    .lean();
  let max = 0;
  for (const r of existing) {
    const m = String(r._id).match(suffixRe);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
