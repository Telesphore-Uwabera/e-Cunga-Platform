import Company from '../models/Company.js';

/** Platform-tenant workspace admins approve new company registrations. */
export async function requirePlatformRegistrationAdmin(req, res, next) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'You need an admin account for this.' });
    }
    const company = await Company.findById(req.user.companyId).lean();
    if (!company?.isPlatformTenant) {
      return res.status(403).json({ error: 'Your company cannot use this page.' });
    }
    return next();
  } catch (e) {
    return res.status(500).json({ error: 'Authorization check failed.' });
  }
}
