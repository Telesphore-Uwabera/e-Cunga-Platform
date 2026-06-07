/** Match server `orgScope` normalization for UI filtering (messaging directory, etc.). */
export function normalizeOrgScopePart(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (v === 'nurse' || v === 'nurses') return 'nursing';
  if (v === 'lab' || v === 'labs' || v === 'laboratory') return 'laboratory';
  if (
    v.includes('silverback') ||
    v.includes('silver back') ||
    v.includes('sliverback') ||
    v.includes('siliverback') ||
    v.includes('silverbacl')
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

/**
 * Whether a clerk may view or mutate a stock row (own items or same dept + location, including supervisor-added).
 */
export function clerkCanAccessStockItem(actor, item) {
  const actorId = String(actor?.id || '').trim();
  if (!actorId) return false;

  if (String(item?.ownerId || item?.clerkId || '').trim() === actorId) return true;

  const actorLocation = normalizeOrgScopePart(actor?.location);
  const actorDepartment = normalizeOrgScopePart(actor?.department || actor?.team);
  if (!actorLocation || !actorDepartment) return false;

  const itemLocation = normalizeOrgScopePart(item?.location);
  const itemDepartment = normalizeOrgScopePart(
    item?.department || item?.team || item?.requestingDepartment
  );
  return itemLocation === actorLocation && itemDepartment === actorDepartment;
}

/** Clerks see records they own OR records that match their location + department. */
export function getClerkVisibleRecords(records, actor) {
  const actorId = String(actor?.id || '').trim();
  if (!actorId) return [];

  const actorLocation = normalizeOrgScopePart(actor?.location);
  const actorDepartment = normalizeOrgScopePart(actor?.department || actor?.team);

  if (!actorLocation || !actorDepartment) {
    return (records || []).filter((item) => String(item.ownerId || item.clerkId || '').trim() === actorId);
  }

  return (records || []).filter((item) => clerkCanAccessStockItem(actor, item));
}
