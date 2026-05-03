import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { nextUserIncrementalId } from './sequence.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function toAuthUser(doc) {
  if (!doc) return null;
  const u = doc.toObject ? doc.toObject() : doc;
  return {
    id: u._id,
    _id: u._id,
    incrementalId: u.incrementalId ?? null,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    companyName: u.companyName,
    industry: u.industry,
    team: u.team,
    location: u.location,
    phone: u.phone || '',
    jobTitle: u.jobTitle || '',
    timeZone: u.timeZone || 'Africa/Kigali',
    notifyEmailDigest: u.notifyEmailDigest !== false,
    notifySecurityAlerts: u.notifySecurityAlerts !== false,
    notifyProductUpdates: Boolean(u.notifyProductUpdates),
    /** Align with schema default `true`; `.lean()` omits field → undefined must not mean inactive. */
    isActive: u.isActive !== false,
    logoUrl: u.logoUrl || '',
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * @returns {{ ok: true, user: object } | { ok: false, pendingCompany?: boolean, inactive?: boolean, message?: string }}
 */
export async function authenticateMongoUser(email, password) {
  const row = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
  if (!row) return { ok: false };
  const ok = await bcrypt.compare(String(password || ''), row.passwordHash);
  if (!ok) return { ok: false };

  const company = await Company.findById(row.companyId).lean();
  if (row.invitePending) {
    return {
      ok: false,
      invitePending: true,
      message: 'Use the 6-digit code in your email. Open the Activate account page to finish.',
    };
  }
  if (company?.registrationStatus === 'rejected') {
    return {
      ok: false,
      rejectedCompany: true,
      message:
        'Your organization’s registration was not approved. Check the email sent to your registered address for details, or contact support if you need help.',
    };
  }
  if (company?.registrationStatus === 'pending') {
    return {
      ok: false,
      pendingCompany: true,
      message: 'Your company is still waiting for admin approval.',
    };
  }
  if (row.isActive === false) {
    return { ok: false, inactive: true, message: 'This account is not active yet.' };
  }
  return { ok: true, user: toAuthUser(row) };
}

export async function createMongoWorkspaceUser({
  companyName,
  fullName,
  email,
  password,
  industry,
  logoUrl,
  phone = '',
  jobTitle = '',
}) {
  const normalizedEmail = normalizeEmail(email);
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new Error('An account with that email already exists.');
  }

  const companyId = `company_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();

  await Company.create({
    _id: companyId,
    name: String(companyName).trim(),
    industry: String(industry || 'Other').trim(),
    type: 'Healthcare / enterprise',
    language: 'EN',
    currency: 'RWF',
    usersLimit: 10,
    registrationStatus: 'pending',
    logoUrl: String(logoUrl || '').trim(),
  });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const incrementalId = await nextUserIncrementalId();
  await User.create({
    _id: userId,
    incrementalId,
    companyId,
    companyName: String(companyName).trim(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'supervisor',
    industry: String(industry || 'Other').trim(),
    team: 'Executive',
    location: 'HQ Kigali',
    phone: String(phone || '').trim(),
    jobTitle: String(jobTitle || '').trim(),
    isActive: false,
    logoUrl: String(logoUrl || '').trim(),
  });

  const companyNameTrim = String(companyName).trim();
  const industryTrim = String(industry || 'Other').trim();

  queueMicrotask(() => {
    import('../services/registrationNotifications.js')
      .then(({ emailNewCompanyRegistrationToAdmins }) =>
        emailNewCompanyRegistrationToAdmins({
          companyId,
          companyName: companyNameTrim,
          industry: industryTrim,
          supervisorName: String(fullName).trim(),
          supervisorEmail: normalizedEmail,
          registeredAt: new Date().toISOString(),
        })
      )
      .catch((e) => console.error('[registration] notify admins:', e));
  });

  return {
    companyId,
    pendingApproval: true,
    message: 'We received your company details. You can sign in after an admin approves your company.',
    companyName: companyNameTrim,
    email: normalizedEmail,
  };
}

export async function createMongoSupplierUser({ fullName, email, password, companyName, industry, phone, location, logoUrl }) {
  const normalizedEmail = normalizeEmail(email);
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    throw new Error('An account with that email already exists.');
  }

  const companyId = `supplier_company_${crypto.randomUUID()}`;
  const userId = crypto.randomUUID();

  // Create supplier company (independent, no approval needed)
  await Company.create({
    _id: companyId,
    name: String(companyName).trim(),
    industry: String(industry || 'Supplier').trim(),
    type: 'Supplier',
    language: 'EN',
    currency: 'RWF',
    usersLimit: 5, // Suppliers have smaller seat limits
    registrationStatus: 'pending', // Suppliers now await approval
    isSupplierCompany: true,
    location: String(location || 'Rwanda').trim(),
    logoUrl: String(logoUrl || '').trim(),
  });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const incrementalIdSupplier = await nextUserIncrementalId();
  await User.create({
    _id: userId,
    incrementalId: incrementalIdSupplier,
    companyId,
    companyName: String(companyName).trim(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'supplier',
    industry: String(industry || 'Supplier').trim(),
    team: 'Supplier',
    location: String(location || 'Rwanda').trim(),
    phone: String(phone || '').trim(),
    isActive: false, // Wait for admin approval
    logoUrl: String(logoUrl || '').trim(),
  });

  const companyNameTrim = String(companyName).trim();
  const industryTrim = String(industry || 'Supplier').trim();

  queueMicrotask(() => {
    import('../services/registrationNotifications.js')
      .then(({ emailNewCompanyRegistrationToAdmins }) =>
        emailNewCompanyRegistrationToAdmins({
          companyId,
          companyName: companyNameTrim,
          industry: industryTrim,
          supervisorName: String(fullName).trim(),
          supervisorEmail: normalizedEmail,
          registeredAt: new Date().toISOString(),
        })
      )
      .catch((e) => console.error('[registration] notify admins:', e));
  });

  return {
    companyId,
    message: 'We received your account details. You can sign in after an admin approves your company.',
    companyName: companyNameTrim,
    email: normalizedEmail,
    role: 'supplier',
  };
}

export async function getMongoUserById(id, emailFallback) {
  const sid = id != null ? String(id).trim() : '';
  let row = null;
  if (sid) {
    row = await User.findById(sid).lean();
  }
  if (!row && emailFallback) {
    row = await User.findOne({ email: normalizeEmail(emailFallback) }).lean();
  }
  return row ? toAuthUser(row) : null;
}
