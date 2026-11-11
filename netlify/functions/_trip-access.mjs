import { createHash, randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readAccess, writeAccess } from "./_trip-access-store.mjs";

const hex = /^[a-f0-9]{64}$/;
const roles = new Set(["editor", "viewer"]);
export const isNativeTrip = (id) => /^pv-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
export const isPersonalKey = (token) => /^pv-personal-[a-f0-9]{64}$/.test(token);
const secret = () => randomBytes(32).toString("hex");
const digest = (token) => createHash("sha256").update(token).digest("hex");
const parse = (response) => JSON.parse(response.body || "{}");
const failure = (json, status, error) => json(status, { error });
const durable = { source: "blobs", local: false, durable: true };

export async function handleNativeTrip({ event, id, sub, token, json }) {
  const method = event.httpMethod;
  const body = ["POST", "PUT", "PATCH"].includes(method) ? JSON.parse(event.body || "{}") : {};
  const publishing = method === "POST" && !id;
  if (publishing) id = body.pvPublish?.id;
  if (!isNativeTrip(id)) return failure(json, 400, "Identificativo viaggio non valido.");
  if (sub) return failure(json, 404, "Risorsa non trovata.");
  const slot = `trip:${id}`;
  const stored = await readAccess(slot);
  const record = stored?.data;
  if (publishing) {
    if (!hex.test(token) || !hex.test(body.pvPublish?.viewToken) ||
        token === body.pvPublish.viewToken || !body.trip || Array.isArray(body.trip) || typeof body.trip !== "object") {
      return failure(json, 400, "Dati di pubblicazione non validi.");
    }
    if (record) {
      if (record.deleted || record.key !== token || record.viewToken !== body.pvPublish.viewToken) {
        return failure(json, 403, "Pubblicazione non autorizzata.");
      }
      return json(200, { ...record, canEdit: true, ...durable });
    }
    const created = {
      id, key: token, viewToken: body.pvPublish.viewToken, trip: { ...body.trip, budget: 0 },
      revision: 1, updated: new Date().toISOString(),
    };
    if (!await writeAccess(slot, created, stored)) return failure(json, 503, "Riprova la pubblicazione.");
    return json(201, { ...created, canEdit: true, ...durable });
  }

  if (!record || record.deleted) return failure(json, 404, "Viaggio non trovato.");
  const canEdit = Boolean(token && token === record.key);
  if (!canEdit && token !== record.viewToken) return failure(json, 401, "Link non valido o scaduto.");
  if (method === "GET") return json(200, { ...record, key: canEdit ? record.key : undefined, canEdit, ...durable });
  if (!canEdit) return failure(json, 403, "Operazione non consentita.");
  if (method === "DELETE") {
    if (!await writeAccess(slot, { deleted: true }, stored)) return failure(json, 409, "Il viaggio è cambiato. Riprova.");
    return json(200, { ok: true, id, deleted: true });
  }
  if (method !== "PUT" && method !== "PATCH") return failure(json, 405, "Metodo non supportato.");
  const trip = body.trip || body;
  if (!trip || Array.isArray(trip) || typeof trip !== "object") return failure(json, 400, "Dati viaggio non validi.");
  if (body.revision !== record.revision) return json(409, { ...record, canEdit: true, ...durable, error: "Il viaggio è cambiato." });
  const updated = { ...record, trip: { ...trip, budget: 0 }, revision: record.revision + 1, updated: new Date().toISOString() };
  if (!await writeAccess(slot, updated, stored)) return failure(json, 409, "Il viaggio è cambiato. Riprova.");
  return json(200, { ...updated, canEdit: true, ...durable });
}

export async function handlePersonalAccess({ event, id, sub, token, json, requestTrip }) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return failure(json, 400, "Identificativo viaggio non valido.");
  const slot = `invites:${id}`;
  const method = event.httpMethod;
  if (sub === "access") {
    if (!token || isPersonalKey(token)) return failure(json, 403, "Serve la chiave di modifica originale.");
    const proof = await requestTrip("GET", token);
    const data = parse(proof);
    if (proof.statusCode !== 200 || data.canEdit !== true || (data.key && data.key !== token)) {
      return failure(json, 403, "Serve la chiave di modifica originale.");
    }
    const stored = await readAccess(slot);
    const invites = stored?.data?.invites || [];
    const revoked = stored?.data?.revoked || [];
    if (method === "GET") {
      return json(200, { invites: invites.map(({ id, name, role, createdAt }) => ({ id, name, role, createdAt })), revoked });
    }
    const body = JSON.parse(event.body || "{}");
    if (method === "POST") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80 || !roles.has(body.role)) return failure(json, 400, "Indica nome e permesso.");
      if (invites.length >= 50) return failure(json, 409, "Revoca un invito prima di aggiungerne un altro.");
      const inviteToken = `pv-personal-${secret()}`;
      const invite = { id: randomBytes(16).toString("hex"), name, role: body.role, hash: digest(inviteToken), createdAt: new Date().toISOString() };
      if (!await writeAccess(slot, { ownerKey: token, invites: [...invites, invite], revoked }, stored)) {
        return failure(json, 409, "Gli inviti sono cambiati. Riprova.");
      }
      return json(201, { id: invite.id, token: inviteToken });
    }
    if (method === "DELETE") {
      const removed = invites.find(invite => invite.id === body.id);
      if (!removed) return failure(json, 404, "Invito non trovato.");
      const remaining = invites.filter(invite => invite !== removed);
      const { id: revokedId, name, role } = removed;
      const history = [{ id: revokedId, name, role, revokedAt: new Date().toISOString() }, ...revoked].slice(0, 50);
      if (!await writeAccess(slot, { ownerKey: remaining.length ? token : "", invites: remaining, revoked: history }, stored)) {
        return failure(json, 409, "Gli inviti sono cambiati. Riprova.");
      }
      return json(200, { ok: true });
    }
    return failure(json, 405, "Metodo non supportato.");
  }

  if (!isPersonalKey(token)) return failure(json, 401, "Invito non valido.");
  const stored = await readAccess(slot);
  const invite = stored?.data?.invites.find(item => item.hash === digest(token));
  if (!invite) return failure(json, 403, "Invito revocato o non valido.");
  if (sub) return failure(json, 403, "Questa operazione non è disponibile tramite invito.");
  const ownerKey = stored.data.ownerKey;
  const response = await requestTrip("GET", ownerKey);
  const current = parse(response);
  if (response.statusCode !== 200 || !current.trip || current.canEdit !== true) {
    return failure(json, response.statusCode >= 500 ? 503 : 403, "Viaggio non disponibile tramite invito.");
  }
  const view = (data) => ({
    id, trip: data.trip, revision: data.revision, updated: data.updated,
    canEdit: invite.role === "editor", personalRole: invite.role, personalName: invite.name,
    source: data.source, local: data.local, durable: data.durable,
  });
  if (method === "GET") return json(200, view(current));
  if (!["PUT", "PATCH"].includes(method) || invite.role !== "editor") {
    return failure(json, 403, "Il tuo invito non consente questa operazione.");
  }
  const body = JSON.parse(event.body || "{}");
  if (!body.trip || Array.isArray(body.trip) || typeof body.trip !== "object") {
    return failure(json, 400, "Dati viaggio non validi.");
  }
  if (!Number.isInteger(body.revision) || body.revision !== current.revision) {
    return json(409, { ...view(current), error: "Il viaggio è cambiato." });
  }
  // Personal editors can edit planning content. Owner-controlled membership and roles remain private to the owner.
  const { members, meta, ...planning } = body.trip;
  if ((members !== undefined && !isDeepStrictEqual(members, current.trip.members)) ||
      (meta?.roles !== undefined && !isDeepStrictEqual(meta.roles, current.trip.meta?.roles)) ||
      (meta?.blockedMembers !== undefined && !isDeepStrictEqual(meta.blockedMembers, current.trip.meta?.blockedMembers))) {
    return failure(json, 403, "Solo il proprietario può gestire partecipanti e ruoli.");
  }
  const currentMeta = current.trip.meta || {};
  const allowedMeta = { ...currentMeta };
  for (const field of ["polls", "preparation", "optimizeReport", "eventExplore", "eventDocumentLinks"]) {
    if (meta?.[field] !== undefined) allowedMeta[field] = meta[field];
  }
  const trip = { ...current.trip };
  for (const field of ["title", "destination", "start", "end", "stops", "bookings", "expenses", "transfers", "checklist", "notes"]) {
    if (planning[field] !== undefined) trip[field] = planning[field];
  }
  trip.meta = allowedMeta;
  const saved = await requestTrip(method, ownerKey, { trip, revision: current.revision });
  if (saved.statusCode >= 400 && saved.statusCode !== 409) return failure(json, saved.statusCode, "Salvataggio non riuscito.");
  const result = parse(saved);
  return json(saved.statusCode, { ...view(result), error: saved.statusCode === 409 ? "Il viaggio è cambiato." : undefined });
}
