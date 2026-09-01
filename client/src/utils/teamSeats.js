/** Roles that consume a buyer workspace seat (suppliers are excluded). */
export const TEAM_SEAT_ROLES = ['clerk', 'accountant', 'supervisor'];

/** Maximum staff seats per subscription plan. null = unlimited. */
export const PLAN_SEAT_LIMITS = {
  essential:    10,
  professional: 15,
  enterprise:   null,
  custom:       null, // legacy alias for enterprise
};

/**
 * Returns the seat limit for a given plan string.
 * Returns null for unlimited (enterprise/custom).
 */
export function planSeatLimit(plan) {
  const key = String(plan || 'essential').toLowerCase();
  const limit = PLAN_SEAT_LIMITS[key];
  return limit === undefined ? 10 : limit; // unknown plan → essential default
}

export function isTeamSeatRole(role) {
  return TEAM_SEAT_ROLES.includes(String(role || '').toLowerCase());
}

export function countTeamSeats(users, companyId) {
  const cid = String(companyId || '').trim();
  return (users || []).filter(
    (u) => (!cid || u.companyId === cid) && isTeamSeatRole(u.role)
  ).length;
}

export function companyTeamUsers(users, companyId) {
  const cid = String(companyId || '').trim();
  return (users || []).filter(
    (u) => (!cid || u.companyId === cid) && isTeamSeatRole(u.role)
  );
}

export function departmentOptionsFromUsers(teamUsers) {
  return [
    ...new Set(
      teamUsers
        .map((u) => String(u.department || u.team || '').trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function locationsForDepartment(teamUsers, department) {
  const deptKey = String(department || '').trim().toLowerCase();
  const pool = deptKey
    ? teamUsers.filter(
        (u) =>
          String(u.department || u.team || '')
            .trim()
            .toLowerCase() === deptKey
      )
    : teamUsers;
  return [
    ...new Set(pool.map((u) => String(u.location || '').trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
}
