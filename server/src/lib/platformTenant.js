import Company from '../models/Company.js';
import User from '../models/User.js';

export async function getPlatformTenantCompanyIds() {
  return Company.find({ isPlatformTenant: true }).distinct('_id');
}

/** Emails of admins on platform-tenant companies (receive new registration alerts). */
export async function getPlatformAdminNotifyTargets() {
  const ids = await getPlatformTenantCompanyIds();
  if (!ids.length) return [];
  const admins = await User.find({ companyId: { $in: ids }, role: 'admin', isActive: true })
    .select('email fullName')
    .lean();
  return admins.map((a) => ({ email: a.email, fullName: a.fullName }));
}
