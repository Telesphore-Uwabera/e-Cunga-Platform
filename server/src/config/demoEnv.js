/**
 * Seeded workspace: one admin user from env (see server/.env.example).
 * Other roles are added via registration / invites, not bulk demo seed.
 */

const DEFAULT_PASSWORD = 'Demo@1234';

const DEFAULT_ADMIN_EMAIL = 'admin@ecunga.com';

const DEFAULT_ADMIN_FULL_NAME = 'Irene Fiston Hirwa';

function envString(key, fallback) {
  const v = process.env[key];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

function envEmail(key, fallback) {
  return envString(key, fallback).toLowerCase();
}

export function getDemoPassword() {
  return envString('DEMO_PASSWORD', DEFAULT_PASSWORD);
}

export function getDemoWorkspaceCompanyName() {
  return envString('DEMO_COMPANY_NAME', 'e-Cunga Portal');
}

export function getDemoUserDefinitions() {
  const companyId = 'company_demo_1';
  const companyName = getDemoWorkspaceCompanyName();

  const profileDefaults = {
    phone: '',
    jobTitle: '',
    timeZone: 'Africa/Kigali',
    notifyEmailDigest: true,
    notifySecurityAlerts: true,
    notifyProductUpdates: false,
  };

  return [
    {
      ...profileDefaults,
      id: 'user_admin_1',
      incrementalId: 1,
      fullName: envString('DEMO_ADMIN_FULL_NAME', DEFAULT_ADMIN_FULL_NAME),
      email: envEmail('DEMO_EMAIL_ADMIN', DEFAULT_ADMIN_EMAIL),
      role: 'admin',
      companyId,
      companyName,
      industry: '',
      isActive: true,
      team: '',
      location: '',
    },
  ];
}

/** Response body for GET /api/auth/demo-credentials */
export function getDemoCredentialsPayload() {
  return {
    password: getDemoPassword(),
    accounts: getDemoUserDefinitions().map((u) => ({ role: u.role, email: u.email })),
  };
}
