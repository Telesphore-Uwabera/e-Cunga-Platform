/**
 * Ecosystem pillars aligned with HomePage sector cards (`home.card*Title` / `home.sector*`).
 * Stored as stable slugs in masterStock.category when admins publish catalog items.
 */
export const ECOSYSTEM_CATALOG_CATEGORY_IDS = ['healthcare', 'hospitality', 'retail', 'public'];

export const ECOSYSTEM_CATEGORY_LABEL_KEYS = {
  healthcare: 'home.cardHealthTitle',
  hospitality: 'home.cardHotelTitle',
  retail: 'home.cardRetailTitle',
  public: 'home.cardPublicTitle',
};

/** Master-stock `sector` field & API filter strings (English, matches marketing filters). */
export const ECOSYSTEM_CATEGORY_SECTOR = {
  healthcare: 'Healthcare',
  hospitality: 'Hospitality',
  retail: 'Retail',
  public: 'Public institutions',
};

export function sectorForEcosystemCategoryId(id) {
  if (!id || typeof id !== 'string') return 'General';
  return ECOSYSTEM_CATEGORY_SECTOR[id] || 'General';
}

export function isEcosystemCategoryId(value) {
  return ECOSYSTEM_CATALOG_CATEGORY_IDS.includes(value);
}

/**
 * Master catalog rows may still carry legacy `category` strings; map to a pillar using `sector` when needed.
 */
export function ecosystemSlugForMasterStockRow(m) {
  if (!m) return ECOSYSTEM_CATALOG_CATEGORY_IDS[0];
  if (isEcosystemCategoryId(m.category)) return m.category;
  const sec = String(m.sector || '').toLowerCase();
  if (sec.includes('hospitality') || sec.includes('hotel')) return 'hospitality';
  if (sec.includes('retail') || sec.includes('wholesale')) return 'retail';
  if (sec.includes('public') || sec.includes('government') || sec.includes('institut')) return 'public';
  if (sec.includes('health')) return 'healthcare';
  return ECOSYSTEM_CATALOG_CATEGORY_IDS[0];
}
