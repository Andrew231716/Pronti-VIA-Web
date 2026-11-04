/** Trip collaboration roles (client-enforced; server still uses edit key / viewToken). */

export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  READONLY: "readonly",
});

const PERMS = {
  [ROLES.OWNER]: ["edit", "invite", "roles", "delete", "expenses", "stops", "docs", "polls", "checklist"],
  [ROLES.ADMIN]: ["edit", "invite", "expenses", "stops", "docs", "polls", "checklist"],
  [ROLES.MEMBER]: ["expenses", "stops", "polls", "checklist", "docs-read"],
  [ROLES.READONLY]: ["docs-read", "polls-vote"],
};

export function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (Object.values(ROLES).includes(r)) return r;
  return ROLES.MEMBER;
}

export function can(role, permission) {
  const r = normalizeRole(role);
  const list = PERMS[r] || [];
  if (list.includes(permission)) return true;
  if (permission === "docs-read" && list.includes("docs")) return true;
  if (permission === "polls-vote" && list.includes("polls")) return true;
  return false;
}

export function roleMapFromTrip(trip) {
  const roles = { ...(trip?.meta?.roles || {}) };
  const members = trip?.members || [];
  if (members[0]?.id && !roles[members[0].id]) roles[members[0].id] = ROLES.OWNER;
  for (const m of members) {
    if (m?.id && !roles[m.id]) roles[m.id] = ROLES.MEMBER;
  }
  return roles;
}
