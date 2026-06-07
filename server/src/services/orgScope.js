/** Normalize location / department strings for consistent scope matching (aligned with stock clerk pooling). */
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

/**
 * Clerks may manage records they own or any stock in their assigned department + location
 * (including items added by supervisors). Mirrors client `getClerkVisibleRecords`.
 */
export function clerkCanAccessStockItem(actor, item) {
  const actorId = String(actor?.id ?? actor?._id ?? '').trim();
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

/** Role broadcast: visible to whole role when unscoped; otherwise only matching dept+location. */
export function portalBroadcastMatchesUser(row, userLike) {
  const sd = String(row.scopeDepartment ?? '').trim();
  const sl = String(row.scopeLocation ?? '').trim();
  if (!sd || !sl) return true;
  const uKey = userOrgScopeKey(userLike);
  if (!uKey) return false;
  const rKey = `${normalizeOrgScopePart(sl)}::${normalizeOrgScopePart(sd)}`;
  return rKey === uKey;
}

export function portalRowVisibleToUser(row, userLike) {
  const uid = row.userId != null ? String(row.userId).trim() : '';
  if (uid) {
    const viewer = String(userLike?.id ?? userLike?._id ?? '').trim();
    return uid === viewer;
  }
  return portalBroadcastMatchesUser(row, userLike);
}

export function requisitionNotifyScope(reqDoc, actor) {
  const scopeLocation = String(reqDoc?.location || actor?.location || '').trim();
  const scopeDepartment = String(
    reqDoc?.requestingDepartment || actor?.department || actor?.team || ''
  ).trim();
  return { scopeDepartment, scopeLocation };
}

export function stockItemNotifyScope(item) {
  return {
    scopeDepartment: String(item?.department || '').trim(),
    scopeLocation: String(item?.location || '').trim(),
  };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOrgScopeRegex(value) {
  const normalized = normalizeOrgScopePart(value);
  if (!normalized) return null;
  const escaped = normalized.split(' ').map(escapeRegex).join('\\s+');
  return new RegExp(`^${escaped}$`, 'i');
}

export function compactNotifyScope({ scopeDepartment, scopeLocation }) {
  const sd = String(scopeDepartment || '').trim();
  const sl = String(scopeLocation || '').trim();
  if (!sd || !sl) return {};
  return { scopeDepartment: sd, scopeLocation: sl };
}

export function requisitionScopeQuery(userLike) {
  const role = String(userLike?.role || '').trim();
  const companyId = String(userLike?.companyId || '').trim();
  const userId = String((userLike?.id ?? userLike?._id) || '').trim();
  if (!companyId) return { _id: '__none__' };

  if (role === 'supplier') {
    const supplierKeys = [...new Set([userId, companyId].filter(Boolean))];
    return supplierKeys.length ? { supplierId: { $in: supplierKeys } } : { _id: '__none__' };
  }

  if (['admin', 'supervisor', 'accountant'].includes(role)) {
    return { companyId };
  }

  const locationRegex = normalizeOrgScopeRegex(userLike?.location);
  const departmentRegex = normalizeOrgScopeRegex(userLike?.department || userLike?.team);
  if (locationRegex && departmentRegex) {
    return {
      companyId,
      location: locationRegex,
      requestingDepartment: departmentRegex,
    };
  }
  if (locationRegex) {
    return { companyId, location: locationRegex };
  }
  if (departmentRegex) {
    return { companyId, requestingDepartment: departmentRegex };
  }

  return { companyId };
}

export function canOpenDirectMessage(viewer, peer) {
  if (!viewer || !peer) return false;
  const a = String(viewer.role || '').trim();
  const b = String(peer.role || '').trim();

  if (a === 'clerk' && b === 'clerk') {
    const ka = userOrgScopeKey(viewer);
    const kb = userOrgScopeKey(peer);
    return Boolean(ka && kb && ka === kb);
  }
  if (
    (a === 'clerk' && (b === 'supervisor' || b === 'accountant')) ||
    (b === 'clerk' && (a === 'supervisor' || a === 'accountant'))
  ) {
    return true;
  }
  if (
    (a === 'supervisor' && b === 'accountant') ||
    (a === 'accountant' && b === 'supervisor')
  ) {
    return true;
  }
  if (a === 'admin' || b === 'admin') return true;
  if (a === 'supplier' || b === 'supplier') return true;
  if (
    (a === 'supervisor' && b === 'supervisor') ||
    (a === 'accountant' && b === 'accountant')
  ) {
    const ka = userOrgScopeKey(viewer);
    const kb = userOrgScopeKey(peer);
    if (!ka || !kb) return true;
    return ka === kb;
  }
  return false;
}
