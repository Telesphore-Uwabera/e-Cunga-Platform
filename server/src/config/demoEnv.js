/**
 * Demo login accounts: password and emails come from environment variables
 * (see server/.env.example). Defaults match the former README values.
 */

const DEFAULT_PASSWORD = 'Demo@1234';

const DEFAULT_EMAILS = {
  admin: 'admin@ecunga.com',
  clerkOne: 'clerk.one@ecunga.com',
  clerkTwo: 'clerk.two@ecunga.com',
  supervisor: 'supervisor@ecunga.com',
  accountant: 'accountant@ecunga.com',
  supplier: 'supplier@ecunga.com',
};

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

/**
 * In-memory demo users and Mongo seed share this shape (no passwordHash).
 * Field `id` is the stable portal user id (JWT sub in demo mode).
 */
export function getDemoWorkspaceCompanyName() {
  return envString('DEMO_COMPANY_NAME', 'Demo Regional Hospital');
}

export function getDemoUserDefinitions() {
  const companyId = 'company_demo_1';
  const companyName = getDemoWorkspaceCompanyName();
  const industry = 'Healthcare';

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
      fullName: 'Aline Uwimana',
      email: envEmail('DEMO_EMAIL_ADMIN', DEFAULT_EMAILS.admin),
      role: 'admin',
      companyId,
      companyName,
      industry,
      isActive: true,
      team: 'Executive',
      location: 'HQ Kigali',
      jobTitle: 'Operations director',
    },
    {
      ...profileDefaults,
      id: 'user_clerk_1',
      fullName: 'Didier Nsengiyumva',
      email: envEmail('DEMO_EMAIL_CLERK_ONE', DEFAULT_EMAILS.clerkOne),
      role: 'clerk',
      companyId,
      companyName,
      industry,
      isActive: true,
      team: 'Warehouse A',
      location: 'Gasabo',
      jobTitle: 'Inventory clerk',
    },
    {
      ...profileDefaults,
      id: 'user_clerk_2',
      fullName: 'Josiane Mukamana',
      email: envEmail('DEMO_EMAIL_CLERK_TWO', DEFAULT_EMAILS.clerkTwo),
      role: 'clerk',
      companyId,
      companyName,
      industry,
      isActive: true,
      team: 'Warehouse B',
      location: 'Kicukiro',
      jobTitle: 'Inventory clerk',
    },
    {
      ...profileDefaults,
      id: 'user_supervisor_1',
      fullName: 'Patrick Ndagijimana',
      email: envEmail('DEMO_EMAIL_SUPERVISOR', DEFAULT_EMAILS.supervisor),
      role: 'supervisor',
      companyId,
      companyName,
      industry,
      isActive: true,
      team: 'Operations',
      location: 'HQ Kigali',
      jobTitle: 'Warehouse supervisor',
    },
    {
      ...profileDefaults,
      id: 'user_accountant_1',
      fullName: 'Claudine Mukeshimana',
      email: envEmail('DEMO_EMAIL_ACCOUNTANT', DEFAULT_EMAILS.accountant),
      role: 'accountant',
      companyId,
      companyName,
      industry,
      isActive: true,
      team: 'Finance',
      location: 'HQ Kigali',
      jobTitle: 'Accountant',
    },
    {
      ...profileDefaults,
      id: 'user_supplier_1',
      fullName: 'MediSupply Rwanda',
      email: envEmail('DEMO_EMAIL_SUPPLIER', DEFAULT_EMAILS.supplier),
      role: 'supplier',
      companyId,
      companyName,
      industry,
      isActive: true,
      team: 'External',
      location: 'Nyarugenge',
      jobTitle: 'Account manager',
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
