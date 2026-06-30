/** Subscription permission keys — keep in sync with admin UI and workspace routes. */

export function getPlanAllowedPermissions(plan) {
  const normPlan = String(plan || 'essential').toLowerCase();
  if (normPlan === 'essential') {
    return [
      'inventory:read',
      'inventory:write',
      'requisitions:manual',
      'requisitions:auto',
      'suppliers:all',
    ];
  }
  if (normPlan === 'professional') {
    return [
      'inventory:read',
      'inventory:write',
      'requisitions:manual',
      'requisitions:auto',
      'reports:weekly',
      'suppliers:all',
    ];
  }
  return [
    'inventory:read',
    'inventory:write',
    'requisitions:manual',
    'requisitions:auto',
    'reports:weekly',
    'suppliers:all',
    'support:dedicated',
    'features:custom',
  ];
}

export function getDefaultPermissions(role, plan) {
  const allowed = getPlanAllowedPermissions(plan);
  const normRole = String(role || 'clerk').toLowerCase();

  let desired = [];
  if (normRole === 'admin' || normRole === 'supervisor') {
    desired = allowed;
  } else if (normRole === 'clerk') {
    desired = ['inventory:read', 'inventory:write', 'requisitions:manual', 'requisitions:auto', 'features:custom'];
  } else if (normRole === 'accountant') {
    desired = ['inventory:read', 'requisitions:manual', 'reports:weekly', 'features:custom', 'suppliers:all'];
  } else {
    desired = ['inventory:read', 'requisitions:manual'];
  }

  return desired.filter((p) => allowed.includes(p));
}

/**
 * Effective permissions for auth/API checks.
 * Uses stored user.permissions when present; otherwise plan defaults for the role.
 */
export function resolveEffectivePermissions(user, companyPlan = 'essential') {
  const role = String(user?.role || '').toLowerCase();
  const stored = Array.isArray(user?.permissions) ? user.permissions.filter(Boolean) : [];
  const plan = String(companyPlan || 'essential').toLowerCase();
  const allowed = getPlanAllowedPermissions(plan);
  const defaults = getDefaultPermissions(role, plan);

  if (['supervisor', 'admin'].includes(role)) {
    const fromStored = stored.filter((p) => allowed.includes(p));
    return [...new Set([...defaults, ...fromStored])];
  }

  if (stored.length > 0) {
    return stored.filter((p) => allowed.includes(p));
  }

  return defaults;
}
