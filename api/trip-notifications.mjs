import { createHash } from "node:crypto";
import webPush from "web-push";
import { handler } from "../netlify/functions/trips.mjs";
import { readAccess, writeAccess } from "../netlify/functions/_trip-access-store.mjs";
import { isPersonalKey } from "../netlify/functions/_trip-access.mjs";
import { computeShareBalances, settleBalances } from "../lib/money.mjs";

const digest = value => createHash("sha256").update(value).digest("hex");
const tripIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const devicePattern = /^[a-f0-9-]{36}$/;
const allowedHosts = /^(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)?push\.apple\.com|(?:[a-z0-9-]+\.)?notify\.windows\.com)$/;
const fields = ["title", "destination", "start", "end", "stops", "bookings", "expenses", "transfers", "checklist", "notes"];
const fingerprint = trip => digest(JSON.stringify([...fields.map(key => trip[key]), trip.meta?.polls, trip.meta?.preparation, trip.meta?.reminders, trip.meta?.eventExplore, trip.meta?.eventDocumentLinks, trip.meta?.packingAssignments, trip.meta?.pinnedNote, trip.meta?.bookingDocuments]));
const normalName = name => String(name || "").trim().normalize("NFC").toLowerCase();

function validSubscription(subscription) {
  try {
    const url = new URL(subscription.endpoint);
    return url.protocol === "https:" && !url.port && !url.username && !url.password &&
      allowedHosts.test(url.hostname) && subscription.endpoint.length <= 2048 &&
      /^[A-Za-z0-9_-]{87}$/.test(subscription.keys.p256dh) &&
      /^[A-Za-z0-9_-]{22}$/.test(subscription.keys.auth);
  } catch {
    return false;
  }
}

async function keys() {
  const slot = "push-config:vapid";
  const saved = await readAccess(slot);
  if (saved?.data) return saved.data;
  const generated = webPush.generateVAPIDKeys();
  if (await writeAccess(slot, generated, null)) return generated;
  const existing = await readAccess(slot);
  if (!existing?.data) throw new Error("Push keys unavailable");
  return existing.data;
}

async function tripFor(id, authorization) {
  const result = await handler({
    httpMethod: "GET", path: `/api/trips/${id}`, headers: { authorization }, vercelAccess: true,
  });
  return result.statusCode === 200 ? JSON.parse(result.body) : null;
}

async function modify(slot, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const stored = await readAccess(slot);
    const result = change(stored?.data || { devices: [], reminders: {} });
    if (!result.next || await writeAccess(slot, result.next, stored)) return result;
  }
  throw new Error("Notification preferences changed concurrently");
}

async function deliver(slot, devices, payload) {
  if (!devices.length) return 0;
  const vapid = await keys();
  const results = await Promise.all(devices.map(async device => {
    try {
      await webPush.sendNotification(device.subscription, JSON.stringify(payload), {
        TTL: 86400, timeout: 5000,
        vapidDetails: { subject: "https://pronti-via.vercel.app/", ...vapid },
      });
      return { delivered: true };
    } catch (error) {
      return { expired: error.statusCode === 404 || error.statusCode === 410, device };
    }
  }));
  const expired = results.filter(result => result.expired).map(result => result.device);
  if (expired.length) {
    await modify(slot, state => ({
      next: { ...state, devices: state.devices.filter(device => !expired.some(old =>
        old.id === device.id && old.subscription.endpoint === device.subscription.endpoint)) },
    })).catch(() => {});
  }
  return results.filter(result => result.delivered).length;
}

export default async function tripNotifications(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const reply = (status, body) => res.status(status).json(body);
  try {
    if (req.method === "GET") return reply(200, { publicKey: (await keys()).publicKey });
    if (req.method !== "POST") return reply(405, { error: "Metodo non supportato." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { tripId, action, deviceId } = body;
    const authorization = req.headers.authorization || "";
    const token = authorization.match(/^Bearer ([^\s]{1,512})$/)?.[1];
    if (!token || !tripIdPattern.test(tripId || "")) return reply(400, { error: "Link viaggio non valido." });
    const slot = `push:${tripId}`;
    const authHash = digest(token);
    if (action === "disable" && devicePattern.test(deviceId || "")) {
      await modify(slot, state => {
        const devices = state.devices.filter(device => device.id !== deviceId || device.authHash !== authHash);
        return devices.length === state.devices.length ? {} : { next: { ...state, devices } };
      });
      return reply(200, { ok: true });
    }
    // Most trips have no subscribers. Avoid rereading the trip on every save in that case.
    if (action === "change" && !(await readAccess(slot))?.data?.devices?.length) return reply(200, { sent: 0 });
    const data = await tripFor(tripId, authorization);
    if (!data?.trip) return reply(403, { error: "Viaggio non disponibile per questo link." });
    const trip = data.trip;
    const members = trip.members || [];
    if (action === "subscribe") {
      if (!devicePattern.test(deviceId || "") || !validSubscription(body.subscription) || !(body.updates || body.expenses)) {
        return reply(400, { error: "Preferenze di notifica non valide." });
      }
      const matches = members.filter(member => normalName(member.name) === normalName(data.personalName || body.name));
      const memberId = matches.length === 1 ? matches[0].id : null;
      const result = await modify(slot, state => {
        const devices = state.devices.filter(device =>
          !(device.id === deviceId && device.authHash === authHash) &&
          device.subscription.endpoint !== body.subscription.endpoint);
        if (devices.length >= 100) return { full: true };
        return { next: { ...state, revision: state.revision ?? data.revision, fingerprint: state.fingerprint ?? fingerprint(trip),
          devices: [...devices, {
            id: deviceId, authHash, personal: isPersonalKey(token), memberId,
            updates: body.updates === true, expenses: body.expenses === true, subscription: body.subscription,
          }] } };
      });
      if (result.full) return reply(409, { error: "Troppe iscrizioni per questo viaggio." });
      return reply(200, { ok: true, linked: Boolean(memberId) });
    }
    if (data.canEdit !== true) return reply(403, { error: "Serve un link con permesso di modifica." });
    if (!["change", "reminder"].includes(action)) return reply(400, { error: "Azione non valida." });
    const inviteList = (await readAccess(`invites:${tripId}`))?.data?.invites || [];
    const eligible = device => (!device.personal || inviteList.some(invite => invite.hash === device.authHash)) &&
      (!device.memberId || members.some(member => member.id === device.memberId));
    let selection;
    if (action === "reminder") {
      const transfer = settleBalances(computeShareBalances(trip)).find(item => item.from === body.from && item.to === body.to);
      if (!transfer) return reply(409, { error: "Il saldo è cambiato. Aggiorna la sezione Spese." });
      const stamp = Date.now();
      selection = await modify(slot, state => {
        const devices = state.devices.filter(device => eligible(device) && device.expenses && device.memberId === transfer.from);
        if (!devices.length) return { devices };
        if (stamp - (state.reminders[transfer.from] || 0) < 60 * 60 * 1000) return { recent: true };
        return { devices, next: { ...state, reminders: { ...state.reminders, [transfer.from]: stamp } } };
      });
      if (selection.recent) return reply(429, { error: "È già stato inviato un promemoria nell’ultima ora." });
      const sent = await deliver(slot, selection.devices, { tripId, kind: action });
      if (!sent && selection.devices.length) {
        await modify(slot, state => {
          if (state.reminders[transfer.from] !== stamp) return {};
          const reminders = { ...state.reminders };
          delete reminders[transfer.from];
          return { next: { ...state, reminders } };
        });
      }
      return reply(200, { sent });
    } else {
      const nextFingerprint = fingerprint(trip);
      selection = await modify(slot, state => {
        if (!state.devices.length || (Number.isInteger(state.revision) && data.revision <= state.revision)) return { devices: [] };
        const devices = state.fingerprint === nextFingerprint ? [] : state.devices.filter(device =>
          eligible(device) && device.updates && !(device.id === deviceId && device.authHash === authHash));
        return { devices, next: { ...state, revision: data.revision, fingerprint: nextFingerprint } };
      });
    }
    const sent = await deliver(slot, selection.devices, { tripId, kind: action });
    return reply(200, { sent });
  } catch (error) {
    if (error instanceof SyntaxError) return reply(400, { error: "Dati non validi." });
    return reply(503, { error: "Notifiche temporaneamente non disponibili. Riprova." });
  }
}
