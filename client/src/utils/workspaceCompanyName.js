/** Treat product branding stored as tenant name as non-displayable for “institution” UI. */
export function isProductPlaceholderCompanyName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  const compact = s.replace(/[\s._-]+/g, '').toLowerCase();
  return compact === 'ecunga' || compact === 'ecungademoworkspace';
}

/**
 * Prefer the registered workspace name; fall back to the signed-in user’s company when portal state still uses a product placeholder.
 */
export function resolveWorkspaceCompanyName(portalCompanyName, userCompanyName) {
  const fromPortal = String(portalCompanyName || '').trim();
  const fromUser = String(userCompanyName || '').trim();
  if (fromPortal && !isProductPlaceholderCompanyName(fromPortal)) return fromPortal;
  if (fromUser) return fromUser;
  return fromPortal || '';
}
