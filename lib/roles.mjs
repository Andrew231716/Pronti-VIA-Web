/**
 * Trip collaboration roles.
 *
 * Mapping IT → code:
 *   proprietario → owner
 *   amministratore → admin
 *   collaboratore → member
 *   visualizzatore → readonly
 *
 * ARCH LIMIT: trips share a single edit `key`. Cryptographic per-member auth is
 * not available without new tokens. Enforcement:
 *   - viewToken → canEdit false (visualizzatore effettivo)
 *   - edit key + optional header X-Pronti-Member-Id → soft server check
 *   - Hub UI always gates by role map in trip.meta.roles
 */

export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  READONLY: "readonly",
});

export const ROLE_LABELS_IT = Object.freeze({
  owner: "proprietario",
  admin: "amministratore",
  member: "collaboratore",
  readonly: "visualizzatore",
});

const PERMS = {
  [ROLES.OWNER]: [
    "edit",
    "invite",
    "roles",
    "delete",
    "expenses",
    "stops",
    "docs",
    "polls",
    "checklist",
    "polls-vote",
    "docs-read",
  ],
  [ROLES.ADMIN]: [
    "edit",
    "invite",
    "expenses",
    "stops",
    "docs",
    "polls",
    "checklist",
    "polls-vote",
    "docs-read",
  ],
  // Collaboratore: può modificare contenuti viaggio, non ruoli/delete/invite.
  [ROLES.MEMBER]: [
    "edit",
    "expenses",
    "stops",
    "polls",
    "checklist",
    "docs-read",
    "polls-vote",
  ],
  [ROLES.READONLY]: ["docs-read", "polls-vote"],
};

export function normalizeRole(role) {
  const r = String(role || "")
    .trim()
    .toLowerCase();
  if (r === "proprietario") return ROLES.OWNER;
  if (r === "amministratore") return ROLES.ADMIN;
  if (r === "collaboratore") return ROLES.MEMBER;
  if (r === "visualizzatore" || r === "viewer") return ROLES.READONLY;
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

export function roleForMember(trip, memberId) {
  if (!memberId) return null;
  const map = roleMapFromTrip(trip);
  return map[memberId] ? normalizeRole(map[memberId]) : null;
}

/** Resolve member id from username/display name against trip.members */
export function findMemberId(trip, identity) {
  const needle = String(identity || "")
    .trim()
    .toLowerCase();
  if (!needle) return "";
  for (const m of trip?.members || []) {
    const name = String(m?.name || "").trim().toLowerCase();
    const uname = String(m?.username || "").trim().toLowerCase();
    if (m?.id && (name === needle || uname === needle)) return m.id;
  }
  return "";
}

/**
 * Permission required for an HTTP mutation.
 * @returns {string|null} permission name or null if no role check
 */
export function permissionForMutation(method, body) {
  const m = String(method || "").toUpperCase();
  if (m === "DELETE") return "delete";
  if (m === "PUT" || m === "PATCH") {
    const trip = body?.trip || body;
    const nextRoles = trip?.meta?.roles;
    const prevHint = body?.__prevRoles;
    if (nextRoles && prevHint && JSON.stringify(nextRoles) !== JSON.stringify(prevHint)) {
      return "roles";
    }
    return "edit";
  }
  return null;
}

export function assertMutationAllowed(trip, memberId, permission) {
  if (!permission) return { ok: true };
  if (!memberId) {
    // Compat: no actor claimed → edit-key holder (legacy) allowed.
    return { ok: true, legacy: true };
  }
  const role = roleForMember(trip, memberId) || ROLES.MEMBER;
  if (!can(role, permission)) {
    return {
      ok: false,
      role,
      permission,
      error: `Operazione non consentita per il ruolo «${ROLE_LABELS_IT[role] || role}».`,
    };
  }
  return { ok: true, role };
}
