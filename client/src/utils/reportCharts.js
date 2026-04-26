/** Shared palette for report donuts / conic gradients (aligned with clerk analytics). */
export const REPORT_SLICE_COLORS = [
  'var(--ec-slice-1)',
  'var(--ec-slice-2)',
  'var(--ec-slice-3)',
  'var(--ec-slice-4)',
  'var(--ec-slice-5)',
  'var(--ec-slice-6)'
];

/**
 * Build `conic-gradient()` stop string from slices with numeric weight.
 * Each slice: `{ value?: number, count?: number, color?: string }`
 */
export function conicGradientFromSlices(slices) {
  const total = slices.reduce((s, x) => s + Number(x.value ?? x.count ?? 0), 0) || 1;
  let acc = 0;
  return slices
    .map((sl) => {
      const v = Number(sl.value ?? sl.count ?? 0);
      const start = (acc / total) * 100;
      acc += v;
      const end = (acc / total) * 100;
      const color = sl.color || '#94a3b8';
      return `${color} ${start}% ${end}%`;
    })
    .join(', ');
}
