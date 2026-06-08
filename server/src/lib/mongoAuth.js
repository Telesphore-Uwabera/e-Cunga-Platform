import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { nextUserIncrementalId } from './sequence.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import { canonicalIndustryFromInput } from './industry.js';
import { resolveEffectivePermissions } from './permissions.js';
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
    department: u.department || '',
    phone: u.phone || '',
    jobTitle: u.jobTitle || '',
    timeZone: u.timeZone || 'Africa/Kigali',
    notifyEmailDigest: u.notifyEmailDigest !== false,
    notifySecurityAlerts: u.notifySecurityAlerts !== false,
    notifyProductUpdates: Boolean(u.notifyProductUpdates),
    notifyWorkflowEmails: u.notifyWorkflowEmails !== false,
    /** Align with schema default `true`; `.lean()` omits field → undefined must not mean inactive. */
    isActive: u.isActive !== false,
    logoUrl: u.logoUrl || '',
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

async function attachResolvedPermissions(user, companyPlan) {
  if (!user) return null;
  let plan = companyPlan;
  if (!plan && user.companyId) {
    const co = await Company.findById(user.companyId).select('plan').lean();
    plan = co?.plan;
  }
  return {
    ...user,
    permissions: resolveEffectivePermissions(user, plan || 'essential'),
  };
}

/**
 * @returns {{ ok: true, user: object } | { ok: false, pendingCompany?: boolean, inactive?: boolean, message?: string }}
 */
export async function authenticateMongoUser(identifier, password) {
  const normalized = String(identifier || '').trim().toLowerCase();
  
  // Try finding by email first, then by phone
  let row = await User.findOne({ email: normalized }).select('+passwordHash');
  if (!row) {
    row = await User.findOne({ phone: String(identifier || '').trim() }).select('+passwordHash');
  }

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
  const user = await attachResolvedPermissions(toAuthUser(row), company?.plan);
  return { ok: true, user };
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

  const industryCanonical = canonicalIndustryFromInput(industry);

  await Company.create({
    _id: companyId,
    name: String(companyName).trim(),
    industry: industryCanonical,
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
    industry: industryCanonical,
    team: 'Executive',
    location: 'HQ Kigali',
    phone: String(phone || '').trim(),
    jobTitle: String(jobTitle || '').trim(),
    isActive: false,
    logoUrl: String(logoUrl || '').trim(),
  });

  const companyNameTrim = String(companyName).trim();

  queueMicrotask(() => {
    import('../services/registrationNotifications.js')
      .then(({ emailNewCompanyRegistrationToAdmins }) =>
        emailNewCompanyRegistrationToAdmins({
          companyId,
          companyName: companyNameTrim,
          industry: industryCanonical,
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

  const industryCanonical = canonicalIndustryFromInput(industry || 'Other');

  await Company.create({
    _id: companyId,
    name: String(companyName).trim(),
    industry: industryCanonical,
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
    industry: industryCanonical,
    team: 'Supplier',
    location: String(location || 'Rwanda').trim(),
    phone: String(phone || '').trim(),
    isActive: false, // Wait for admin approval
    logoUrl: String(logoUrl || '').trim(),
  });

  const companyNameTrim = String(companyName).trim();

  queueMicrotask(() => {
    import('../services/registrationNotifications.js')
      .then(({ emailNewCompanyRegistrationToAdmins }) =>
        emailNewCompanyRegistrationToAdmins({
          companyId,
          companyName: companyNameTrim,
          industry: industryCanonical,
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
  if (!row) return null;
  const co = row.companyId ? await Company.findById(row.companyId).select('plan').lean() : null;
  return attachResolvedPermissions(toAuthUser(row), co?.plan);
}
