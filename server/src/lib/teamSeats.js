/** Roles that consume a buyer workspace seat (suppliers are excluded). */
export const TEAM_SEAT_ROLES = ['clerk', 'accountant', 'supervisor'];

export function isTeamSeatRole(role) {
  return TEAM_SEAT_ROLES.includes(String(role || '').toLowerCase());
}
