/**
 * Avatar / logo priority used across AppShell and settings pages:
 * organization (portal company) logo first, then the signed-in user's profile photo.
 */
export function resolveWorkspaceAvatarUrl(company, userLike) {
  const org = String(company?.logoUrl ?? '').trim();
  if (org) return org;
  return String(userLike?.logoUrl ?? '').trim();
}
