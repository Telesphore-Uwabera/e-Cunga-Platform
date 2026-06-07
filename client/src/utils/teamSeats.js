/** Roles that consume a buyer workspace seat (suppliers are excluded). */
export const TEAM_SEAT_ROLES = ['clerk', 'accountant', 'supervisor'];

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
