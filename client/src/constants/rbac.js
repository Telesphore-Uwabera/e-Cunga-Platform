/** URL segment per role — must match server `User.role` values. */
export const ROLES = ['clerk', 'supervisor', 'accountant', 'admin', 'supplier'];

export const ROLE_LABELS = {
  clerk: 'Inventory clerk',
  supervisor: 'Supervisor',
  accountant: 'Accountant',
  admin: 'Admin',
  supplier: 'Supplier',
};

/** Sidebar navigation aligned with design board (per role). */
export const NAV_BY_ROLE = {
  clerk: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'inventory', label: 'Inventory list' },
    { segment: 'expiry', label: 'Expiry tracking' },
    { segment: 'materials', label: 'Request materials' },
    { segment: 'alerts', label: 'Analytics' },
    { segment: 'usage', label: 'Record usage' },
    { segment: 'documents', label: 'Full Inventory Movement' },
    { segment: 'settings', label: 'Settings' },
  ],
  supervisor: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'clerks', label: 'Clerks' },
    { segment: 'accountants', label: 'Accountants' },
    { segment: 'suppliers', label: 'Suppliers' },
    { segment: 'supplier-directory', label: 'Marketplace' },
    { segment: 'visibility', label: 'Inventory' },
    { segment: 'approvals', label: 'Pending Approval' },
    { segment: 'invoices', label: 'Monitoring' },
    { segment: 'reports', label: 'Reports' },
    { segment: 'team', label: 'Team' },
    { segment: 'settings', label: 'Company settings' },
  ],
  accountant: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'approvals', label: 'Proforma invoices' },
    { segment: 'invoices', label: 'Invoice management' },
    { segment: 'payments', label: 'Payment processing' },
    { segment: 'reports', label: 'Supplier transactions' },
    { segment: 'settings', label: 'Settings' },
  ],
  admin: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'users', label: 'User management' },
    { segment: 'rbac', label: 'Roles & access' },
    { segment: 'profile', label: 'My profile' },
    { segment: 'settings', label: 'Company settings' },
    { segment: 'reports', label: 'Reports & analytics' },
    { segment: 'activity', label: 'Notifications center' },
    { segment: 'help', label: 'Help center' },
  ],
  supplier: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'inbox', label: 'Request & Proformas' },
    { segment: 'documents', label: 'Invoice' },
    { segment: 'products', label: 'Products' },
    { segment: 'delivery', label: 'Delivery' },
    { segment: 'payments', label: 'Payments' },
    { segment: 'settings', label: 'Settings' },
  ],
};

const EXTRA_SEGMENTS_BY_ROLE = {
  /**
   * Not shown in the left nav (messages/notifications use the top bar); routes stay valid.
   */
  clerk: ['messages', 'profile', 'account-settings', 'notifications'],
  supervisor: ['messages', 'profile', 'account-settings', 'notifications', 'preferences'],
  accountant: ['messages', 'profile', 'account-settings', 'notifications'],
  admin: ['messages', 'profile', 'account-settings', 'notifications'],
  /** Legacy supplier URL; supplier-only editor routes (not in main nav) */
  supplier: ['history', 'product-edit', 'messages', 'profile', 'account-settings', 'notifications'],
};

export function isValidRole(role) {
  return ROLES.includes(role);
}

export function allowedSegmentForRole(role, segment, user) {
  if (role === 'admin' && segment === 'company-registrations' && user?.canApproveRegistrations) {
    return true;
  }
  const nav = NAV_BY_ROLE[role];
  const extra = EXTRA_SEGMENTS_BY_ROLE[role] || [];
  if (!nav) return extra.includes(segment);
  return nav.some((item) => item.segment === segment) || extra.includes(segment);
}

