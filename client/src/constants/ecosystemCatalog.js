/**
 * Ecosystem pillars aligned with HomePage sector cards (`home.card*Title` / `home.sector*`).
 * Stored as stable slugs in masterStock.category when admins publish catalog items.
 */
export const ECOSYSTEM_CATALOG_CATEGORY_IDS = ['healthcare', 'hospitality', 'retail', 'public'];

/**
 * Healthcare workspace stock categories (display + stored value for healthcare companies).
 * Used for clerk, supervisor, supplier, and add/edit stock when `isHealthcareCompany(company)`.
 */
export const HEALTHCARE_STOCK_CATEGORIES = [
  'Laboratory',
  'Medical Consumables',
  'Medications',
  'Sanitation',
  'Office Materials',
  'Medical Materials',
  'Others',
];

const HEALTHCARE_SKU_PREFIX = {
  Laboratory: 'LAB',
  'Medical Consumables': 'MCO',
  Medications: 'MED',
  Sanitation: 'SAN',
  'Office Materials': 'OFF',
  'Medical Materials': 'MMA',
  Others: 'OTH',
};

/** True when the org should use {@link HEALTHCARE_STOCK_CATEGORIES} instead of ecosystem pillars. */
export function isHealthcareCompany(company) {
  const t = String(company?.type ?? 'Healthcare').trim().toLowerCase();
  if (['hospitality', 'retail', 'public', 'public institutions'].includes(t)) return false;
  if (t.startsWith('hospitality') || t.startsWith('retail') || t === 'public institutions') return false;
  return true;
}

export function healthcareSkuPrefix(category) {
  const c = String(category || '').trim();
  if (HEALTHCARE_SKU_PREFIX[c]) return HEALTHCARE_SKU_PREFIX[c];
  return 'GEN';
}

/**
 * Map legacy / mixed-case rows to a canonical healthcare bucket (for filters and new defaults).
 */
export function normalizeToHealthcareCategory(stored) {
  const s0 = String(stored ?? '').trim();
  const hit = HEALTHCARE_STOCK_CATEGORIES.find(c => c.toLowerCase() === s0.toLowerCase());
  if (hit) return hit;
  const s = s0.toLowerCase();
  if (['healthcare', 'hospitality', 'retail', 'public'].includes(s)) return 'Others';
  if (s.includes('pharmacy') || s.includes('medication') || s === 'medications' || s === 'pharmaceutical') {
    return 'Medications';
  }
  if (s.includes('laboratory') || s === 'lab') return 'Laboratory';
  if (s.includes('sanitat') || s.includes('disinfect') || s.includes('hand sanitizer')) return 'Sanitation';
  if (s.includes('office') || s.includes('paper') || s.includes('envelop')) return 'Office Materials';
  if (s.includes('medical material')) return 'Medical Materials';
  if (s.includes('consumable') || s.includes('glove') || s.includes('gauze') || s.includes('sterile')) {
    return 'Medical Consumables';
  }
  if (
    s.includes('equipment') ||
    s.includes('surgical') ||
    s.includes('implant') ||
    (s.includes('material') && !s.includes('office'))
  ) {
    return 'Medical Materials';
  }
  return s0 || 'Others';
}

export function mapMasterStockToHealthcareCategory(m) {
  if (!m) return HEALTHCARE_STOCK_CATEGORIES[0];
  return normalizeToHealthcareCategory(m.category);
}

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
