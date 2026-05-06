/** Match server `orgScope` normalization for UI filtering (messaging directory, etc.). */
export function normalizeOrgScopePart(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (v === 'nurse' || v === 'nurses') return 'nursing';
  if (v === 'lab' || v === 'labs' || v === 'laboratory') return 'laboratory';
  if (
    v === 'silver back' ||
    v === 'silverback' ||
    v === 'silverbackmall' ||
    v === 'sliverback mall'
  ) {
    return 'silverback mall';
  }
  return v;
}

export function userOrgScopeKey(userLike) {
  const location = normalizeOrgScopePart(userLike?.location);
  const department = normalizeOrgScopePart(userLike?.department || userLike?.team);
  if (!location || !department) return '';
  return `${location}::${department}`;
}

export function usersShareClerkMessagingScope(a, b) {
  const ka = userOrgScopeKey(a);
  const kb = userOrgScopeKey(b);
  return Boolean(ka && kb && ka === kb);
}
