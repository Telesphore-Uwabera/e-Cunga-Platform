/**
 * Avatar / logo priority used across AppShell and settings pages:
 * organization (portal company) logo first, then the signed-in user's profile photo.
 */

/**
 * Logos saved during local dev often use http://localhost/... Those URLs break on HTTPS
 * production (mixed content). Treat them as absent so we fall back to a usable user logo.
 */
export function isLogoUrlBlockedInBrowser(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:') return false;
    const h = u.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
  } catch {
    return false;
  }
}

/** Non-empty logo string safe to use as an <img src> on this page (HTTPS-aware). */
export function cleanRemoteLogoUrl(raw) {
  const s = String(raw ?? '').trim();
  return s && !isLogoUrlBlockedInBrowser(s) ? s : '';
}

export function resolveWorkspaceAvatarUrl(company, userLike) {
  const org = cleanRemoteLogoUrl(company?.logoUrl);
  if (org) return org;
  return cleanRemoteLogoUrl(userLike?.logoUrl);
}

/**
 * Ordered candidates for the shell avatar: try org, then user (deduped).
 * Used with onError to recover when the server still stores a bad URL we did not detect.
 */
export function workspaceAvatarUrlChain(company, userLike) {
  const org = cleanRemoteLogoUrl(company?.logoUrl);
  const u = cleanRemoteLogoUrl(userLike?.logoUrl);
  const chain = [];
  if (org) chain.push(org);
  if (u && u !== org) chain.push(u);
  return chain;
}
