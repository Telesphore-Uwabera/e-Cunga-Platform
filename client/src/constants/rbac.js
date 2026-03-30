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
    { segment: 'requests', label: 'Stock operations' },
    { segment: 'alerts', label: 'Analytics' },
    { segment: 'documents', label: 'Billing items' },
    { segment: 'messages', label: 'Messages & alerts' },
  ],
  supervisor: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'visibility', label: 'Inventory' },
    { segment: 'approvals', label: 'Approvals' },
    { segment: 'invoices', label: 'Monitoring' },
    { segment: 'reports', label: 'Reports' },
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
    { segment: 'rbac', label: 'Roles & access' },
    { segment: 'settings', label: 'Company settings' },
    { segment: 'reports', label: 'Reports & analytics' },
    { segment: 'activity', label: 'Notifications center' },
    { segment: 'messages', label: 'Messages' },
    { segment: 'help', label: 'Help center' },
  ],
  supplier: [
    { segment: 'dashboard', label: 'Dashboard' },
    { segment: 'inbox', label: 'Incoming requests' },
    { segment: 'approved-proforma', label: 'Approved proformas' },
    { segment: 'rejected-proforma', label: 'Rejected proformas' },
    { segment: 'documents', label: 'Delivery & official invoice' },
    { segment: 'products', label: 'Products' },
    { segment: 'delivery', label: 'Delivery' },
    { segment: 'payments', label: 'Payments' },
    { segment: 'messages', label: 'Messages & notices' },
    { segment: 'settings', label: 'Settings' },
  ],
};

const EXTRA_SEGMENTS_BY_ROLE = {
  clerk: ['usage'],
  /** Legacy supplier URL; supplier-only editor routes (not in main nav) */
  supplier: ['history', 'product-edit'],
};

export function isValidRole(role) {
  return ROLES.includes(role);
}

export function allowedSegmentForRole(role, segment) {
  const nav = NAV_BY_ROLE[role];
  const extra = EXTRA_SEGMENTS_BY_ROLE[role] || [];
  if (!nav) return extra.includes(segment);
  return nav.some((item) => item.segment === segment) || extra.includes(segment);
}

