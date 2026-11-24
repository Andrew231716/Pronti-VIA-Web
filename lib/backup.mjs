/** Personal backup / restore — schema-versioned, non-destructive by default. */

export const BACKUP_SCHEMA = 1;
export const BACKUP_KIND = "pronti-via-backup";

export function createBackup({
  trips = [],
  account = null,
  preferences = {},
  localStores = {},
} = {}) {
  return {
    kind: BACKUP_KIND,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: "Pronti? VIA!",
    account: account
      ? {
          username: account.username || account.user?.username || "",
          displayName: account.displayName || account.user?.displayName || "",
        }
      : null,
    preferences,
    trips: Array.isArray(trips) ? trips : [],
    localStores: localStores && typeof localStores === "object" ? localStores : {},
  };
}

export function validateBackup(raw) {
  const errors = [];
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ["JSON non valido."], data: null, summary: null };
    }
  }
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["Backup vuoto."], data: null, summary: null };
  }
  if (data.kind !== BACKUP_KIND) errors.push("Tipo file non riconosciuto (kind).");
  const schema = Number(data.schema);
  if (!Number.isFinite(schema) || schema < 1) errors.push("Schema mancante o non valido.");
  if (schema > BACKUP_SCHEMA) errors.push(`Schema ${schema} più recente di ${BACKUP_SCHEMA}.`);
  if (!Array.isArray(data.trips)) errors.push("Campo trips assente.");
  const trips = Array.isArray(data.trips) ? data.trips : [];
  const summary = {
    schema: schema || null,
    exportedAt: data.exportedAt || null,
    tripCount: trips.length,
    titles: trips
      .map((t) => t?.trip?.title || t?.title || t?.id || "?")
      .slice(0, 12),
    hasLocalStores: Boolean(data.localStores && Object.keys(data.localStores).length),
  };
  return { ok: errors.length === 0, errors, data, summary };
}

/**
 * Merge strategy: never wipe existing by default.
 * mode: "merge" | "skip-existing" | "replace-listed"
 */
export function planRestore(existingTrips, backupTrips, { mode = "merge" } = {}) {
  const existing = Array.isArray(existingTrips) ? existingTrips : [];
  const incoming = Array.isArray(backupTrips) ? backupTrips : [];
  const byId = new Map();
  for (const t of existing) {
    const id = t?.id || t?.trip?.id;
    if (id) byId.set(id, t);
  }
  const actions = [];
  for (const t of incoming) {
    const id = t?.id || t?.trip?.id;
    if (!id) {
      actions.push({ action: "skip", reason: "missing-id", item: t });
      continue;
    }
    if (!byId.has(id)) {
      actions.push({ action: "add", id, item: t });
      continue;
    }
    if (mode === "skip-existing") {
      actions.push({ action: "skip", id, reason: "exists" });
    } else if (mode === "replace-listed") {
      actions.push({ action: "replace", id, item: t });
    } else {
      const cur = byId.get(id);
      const curRev = Number(cur.revision || cur.trip?.revision || 0);
      const inRev = Number(t.revision || t.trip?.revision || 0);
      if (inRev > curRev) actions.push({ action: "replace", id, item: t, reason: "newer-revision" });
      else actions.push({ action: "skip", id, reason: "same-or-older" });
    }
  }
  return {
    actions,
    adds: actions.filter((a) => a.action === "add").length,
    replaces: actions.filter((a) => a.action === "replace").length,
    skips: actions.filter((a) => a.action === "skip").length,
  };
}

export function applyRestorePlan(existingTrips, plan) {
  const map = new Map();
  for (const t of existingTrips || []) {
    const id = t?.id || t?.trip?.id;
    if (id) map.set(id, t);
  }
  for (const a of plan.actions || []) {
    if (a.action === "add" || a.action === "replace") map.set(a.id, a.item);
  }
  return [...map.values()];
}
