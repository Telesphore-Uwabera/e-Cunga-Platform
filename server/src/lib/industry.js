/** Canonical industries — keep aligned with client RegisterPage INDUSTRY_VALUES */
export const CANONICAL_INDUSTRIES = [
  'Healthcare',
  'Laboratory',
  'Hotel / hospitality',
  'Retail & wholesale',
  'Industry / manufacturing',
  'Agribusiness',
  'Government / NGO',
  'Other',
];

const LEGACY_PLACEHOLDER = new Set(['supplier', '']);

/**
 * Normalized key for equality checks (lowercase canonical label or legacy trimmed value).
 */
export function normalizeIndustry(value) {
  const raw = String(value || '').trim();
  if (!raw || LEGACY_PLACEHOLDER.has(raw.toLowerCase())) return '';

  const match = CANONICAL_INDUSTRIES.find((i) => i.toLowerCase() === raw.toLowerCase());
  if (match) return match.toLowerCase();

  return raw.toLowerCase();
}

/** Human-readable label for API/UI from any stored value. */
export function industryDisplayLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = CANONICAL_INDUSTRIES.find((i) => i.toLowerCase() === raw.toLowerCase());
  return match || raw;
}

/** Coerce registration/profile input to a stored canonical label. */
export function canonicalIndustryFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Other';
  const match = CANONICAL_INDUSTRIES.find((i) => i.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  if (raw.toLowerCase() === 'supplier') return 'Other';
  return raw;
}

export function resolveCompanyIndustry(company, supplierUser) {
  const fromCompany = normalizeIndustry(company?.industry);
  if (fromCompany) return fromCompany;
  return normalizeIndustry(supplierUser?.industry);
}

export function resolveBuyerIndustry(buyerCompany, authUser) {
  const fromCompany = normalizeIndustry(buyerCompany?.industry);
  if (fromCompany) return fromCompany;
  return normalizeIndustry(authUser?.industry);
}

export function industriesMatch(a, b) {
  const na = normalizeIndustry(a);
  const nb = normalizeIndustry(b);
  if (!na || !nb) return true;
  return na === nb;
}

export function buyerIndustryDisplay(buyerCompany, authUser) {
  const norm = resolveBuyerIndustry(buyerCompany, authUser);
  if (!norm) return '';
  return industryDisplayLabel(norm) || industryDisplayLabel(buyerCompany?.industry) || industryDisplayLabel(authUser?.industry) || '';
}
