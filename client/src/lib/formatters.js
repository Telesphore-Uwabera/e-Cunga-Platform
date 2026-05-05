import {
  ECOSYSTEM_CATEGORY_SECTOR,
  isEcosystemCategoryId,
  isHealthcareCompany,
  normalizeToHealthcareCategory,
} from '../constants/ecosystemCatalog.js';

/** Display label for a stored category (optional company scopes healthcare normalization). */
export function categoryFilterOptionLabel(category, company) {
  const c = String(category ?? '').trim();
  if (!c) return '';
  if (company && isHealthcareCompany(company)) {
    const norm = normalizeToHealthcareCategory(c);
    // If normalization resulted in 'Others' but the original was something specific, keep the original
    if (norm === 'Others' && c !== 'Others' && !isEcosystemCategoryId(c.toLowerCase())) {
      return c;
    }
    return norm;
  }
  if (isEcosystemCategoryId(c)) {
    return ECOSYSTEM_CATEGORY_SECTOR[c] || c;
  }
  if (c === 'Pharmacy') return 'Medications';
  if (c === 'Laboratory') return 'Laboratory';
  return c;
}
