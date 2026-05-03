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
    return normalizeToHealthcareCategory(c);
  }
  if (isEcosystemCategoryId(c)) {
    return ECOSYSTEM_CATEGORY_SECTOR[c] || c;
  }
  if (c === 'Pharmacy') return 'Medications';
  if (c === 'Laboratory') return 'Laboratory';
  return c;
}
