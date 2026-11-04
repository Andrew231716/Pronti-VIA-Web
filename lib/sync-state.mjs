/** Save / sync status model for UI honesty. */

export const SaveStatus = Object.freeze({
  SERVER: "server",
  LOCAL: "local",
  PENDING: "pending",
  ERROR: "error",
});

export const SAVE_MSG = Object.freeze({
  SERVER: "Salvato e sincronizzato",
  LOCAL: "Salvato su questo dispositivo. In attesa di sincronizzazione",
  PENDING: "In attesa di sincronizzazione",
  ERROR: "Salvataggio non riuscito",
  CONFLICT: "Versione non aggiornata. Ricarica e riprova: le modifiche più recenti non sono state sovrascritte.",
  CREATE_SERVER: "Viaggio creato e sincronizzato. Conserva il link per ritrovarlo.",
  CREATE_LOCAL: "Viaggio creato su questo dispositivo. In attesa di sincronizzazione. Conserva il link.",
});

export function classifyPersistence({ local, source, ok, status } = {}) {
  if (ok === false || status === 409) return status === 409 ? SaveStatus.ERROR : SaveStatus.ERROR;
  if (local === true || source === "memory") return SaveStatus.LOCAL;
  if (source === "blobs" || source === "file" || source === "supabase" || source === "store") {
    return SaveStatus.SERVER;
  }
  if (local === false) return SaveStatus.SERVER;
  return SaveStatus.PENDING;
}

export function statusLabel(status, { online } = {}) {
  switch (status) {
    case SaveStatus.SERVER:
      return SAVE_MSG.SERVER;
    case SaveStatus.LOCAL:
      return online === false
        ? "Salvato in locale (offline). In attesa di sincronizzazione"
        : SAVE_MSG.LOCAL;
    case SaveStatus.PENDING:
      return SAVE_MSG.PENDING;
    case SaveStatus.ERROR:
      return SAVE_MSG.ERROR;
    default:
      return "Stato sconosciuto";
  }
}

/** Toast copy for trip PUT/PATCH responses (shared by SPA shim, ux-suite, Hub). */
export function saveToastFromResponse(data = {}, { create = false } = {}) {
  if (data && data.ok === false) return SAVE_MSG.ERROR;
  const status = classifyPersistence(data);
  if (create) {
    return status === SaveStatus.LOCAL || status === SaveStatus.PENDING
      ? SAVE_MSG.CREATE_LOCAL
      : SAVE_MSG.CREATE_SERVER;
  }
  if (status === SaveStatus.LOCAL || status === SaveStatus.PENDING) return SAVE_MSG.LOCAL;
  if (status === SaveStatus.ERROR) return SAVE_MSG.ERROR;
  return SAVE_MSG.SERVER;
}

export function enqueueOutbox(queue, item, { max = 100 } = {}) {
  const q = Array.isArray(queue) ? queue.slice() : [];
  const entry = {
    id: item?.id || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: item?.type || "trip-put",
    payload: item?.payload ?? null,
    tripId: item?.tripId || "",
    revision: item?.revision,
    key: item?.key || "",
    createdAt: item?.createdAt || new Date().toISOString(),
    attempts: Number(item?.attempts) || 0,
  };
  // de-dupe same trip put
  const filtered = q.filter(
    (x) => !(x.tripId && entry.tripId && x.tripId === entry.tripId && x.type === entry.type)
  );
  filtered.unshift(entry);
  return filtered.slice(0, max);
}

export function markAttempt(queue, id) {
  return (queue || []).map((x) =>
    x.id === id ? { ...x, attempts: (Number(x.attempts) || 0) + 1 } : x
  );
}

export function removeFromOutbox(queue, id) {
  return (queue || []).filter((x) => x.id !== id);
}

export function detectConflict(clientRev, serverRev) {
  const c = Number(clientRev);
  const s = Number(serverRev);
  if (!Number.isFinite(c) || !Number.isFinite(s)) return false;
  return c !== s;
}
