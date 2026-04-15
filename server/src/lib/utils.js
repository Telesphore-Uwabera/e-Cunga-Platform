export function companyId(req) {
  return String(req.user?.companyId || '');
}
