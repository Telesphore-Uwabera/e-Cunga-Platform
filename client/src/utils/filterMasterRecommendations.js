/**
 * Client-side filter for master-catalog recommendation rows (sector grids).
 * @param {unknown[]} masterStock
 * @param {string} query
 * @returns {unknown[]}
 */
export function filterMasterRecommendations(masterStock, query) {
  const q = String(query ?? '').trim().toLowerCase();
  const list = Array.isArray(masterStock) ? masterStock : [];
  if (!q) return list;
  return list.filter((m) => {
    if (!m || typeof m !== 'object') return false;
    const name = String(m.name ?? '').toLowerCase();
    const cat = String(m.category ?? '').toLowerCase();
    const desc = String(m.description ?? '').toLowerCase();
    const id = String(m._id ?? m.id ?? '').toLowerCase();
    const sector = String(m.sector ?? '').toLowerCase();
    const unit = String(m.unit ?? '').toLowerCase();
    return (
      name.includes(q) ||
      cat.includes(q) ||
      desc.includes(q) ||
      id.includes(q) ||
      sector.includes(q) ||
      unit.includes(q)
    );
  });
}
