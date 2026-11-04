/** Save / sync status model for UI honesty. */

export const SaveStatus = Object.freeze({
  SERVER: "server",
  LOCAL: "local",
  PENDING: "pending",
  ERROR: "error",
});

export function classifyPersistence({ local, source, ok } = {}) {
  if (ok === false) return SaveStatus.ERROR;
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
      return "Salvato sul server";
    case SaveStatus.LOCAL:
      return online === false
        ? "Salvato in locale (offline)"
        : "Salvato solo su questo dispositivo";
    case SaveStatus.PENDING:
      return "In attesa di sincronizzazione";
    case SaveStatus.ERROR:
      return "Errore di salvataggio";
    default:
      return "Stato sconosciuto";
  }
}

export function enqueueOutbox(queue, item, { max = 100 } = {}) {
  const q = Array.isArray(queue) ? queue.slice() : [];
  const entry = {
    id: item?.id || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: item?.type || "trip-put",
    payload: item?.payload ?? null,
    tripId: item?.tripId || "",
    revision: item?.revision,
    createdAt: item?.createdAt || new Date().toISOString(),
    attempts: Number(item?.attempts) || 0,
  };
  q.unshift(entry);
  return q.slice(0, max);
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
