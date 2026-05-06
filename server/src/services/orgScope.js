/** Normalize location / department strings for consistent scope matching (aligned with stock clerk pooling). */
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

export function compactNotifyScope({ scopeDepartment, scopeLocation }) {
  const sd = String(scopeDepartment || '').trim();
  const sl = String(scopeLocation || '').trim();
  if (!sd || !sl) return {};
  return { scopeDepartment: sd, scopeLocation: sl };
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
