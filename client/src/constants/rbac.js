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
    { segment: 'requests', label: 'Request materials' },
    { segment: 'alerts', label: 'Expiry & usage' },
    { segment: 'documents', label: 'Reports & documents' },
    { segment: 'messages', label: 'Messages & alerts' },
  ],
  supervisor: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'visibility', label: 'Inventory overview' },
    { segment: 'approvals', label: 'Requests approval' },
    { segment: 'invoices', label: 'Clerk monitoring' },
    { segment: 'reports', label: 'Reports & oversight' },
    { segment: 'messages', label: 'Messages & alerts' },
  ],
  accountant: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'approvals', label: 'Pending requests' },
    { segment: 'invoices', label: 'Invoice management' },
    { segment: 'payments', label: 'Payment processing' },
    { segment: 'reports', label: 'Supplier transactions' },
    { segment: 'messages', label: 'Finance messages' },
  ],
  admin: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'users', label: 'User management' },
    { segment: 'settings', label: 'Company settings' },
    { segment: 'reports', label: 'Reports & analytics' },
    { segment: 'activity', label: 'Notifications center' },
  ],
  supplier: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'inbox', label: 'Orders inbox' },
    { segment: 'documents', label: 'Delivery documents' },
    { segment: 'history', label: 'Completed supplies' },
    { segment: 'messages', label: 'Messages & notices' },
  ],
};

export function isValidRole(role) {
  return ROLES.includes(role);
}

export function allowedSegmentForRole(role, segment) {
  const nav = NAV_BY_ROLE[role];
  if (!nav) return false;
  return nav.some((item) => item.segment === segment);
}

