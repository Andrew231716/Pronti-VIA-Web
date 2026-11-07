import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readAccess, writeAccess } from "../netlify/functions/_trip-access-store.mjs";
import { corsHeadersFor } from "../lib/cors.mjs";

const derive = promisify(scrypt);
const ttl = 30 * 86400_000;
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,23}@via$/;
const digest = value => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(20).toString("hex");
const attempts = new Map();
function limited(key, limit) {
  const now = Date.now();
  if (attempts.size > 4096) for (const [id, entry] of attempts) {
    if (entry.until <= now) attempts.delete(id);
  }
  if (attempts.size > 4096 && !attempts.has(key)) return true;
  let entry = attempts.get(key);
  if (!entry || entry.until <= now) {
    entry = { count: 0, until: now + 60_000 };
    attempts.set(key, entry);
  }
  return ++entry.count > limit;
}
async function credentials(password) {
  const salt = random();
  const hash = (await derive(password, salt, 64)).toString("hex");
  return { salt, hash };
}
async function verify(password, user) {
  const actual = await derive(password, user.salt, 64);
  return timingSafeEqual(actual, Buffer.from(user.hash, "hex"));
}
function session(user, replace = false) {
  const secret = random();
  const expiresAt = Date.now() + ttl;
  const active = replace ? [] : user.sessions.filter(s => s.expiresAt > Date.now()).slice(-11);
  user.sessions = [...active, { hash: digest(secret), expiresAt }];
  return { token: `pvacct:${user.username}:${secret}`, expiresAt };
}
function payload(user, extra = {}) {
  return { user: { username: user.username, displayName: user.username.slice(0, -4) }, trips: user.trips, ...extra };
}
function cleanTrips(input) {
  const trips = new Map();
  for (const item of Array.isArray(input) ? input.slice(0, 40) : []) {
    if (typeof item?.id !== "string" || typeof item.key !== "string" || !item.id || !item.key ||
      item.id.length > 160 || item.key.length > 240) continue;
    trips.set(item.id, { id: item.id, key: item.key, title: typeof item.title === "string" ? item.title.slice(0, 120) : "Viaggio" });
  }
  return [...trips.values()];
}

export default async function recoveryAccount(req, res) {
  for (const [key, value] of Object.entries(corsHeadersFor(req, {
    methods: "GET, POST, PUT, OPTIONS", headers: "Content-Type, Authorization",
  }))) res.setHeader(key, value);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  const send = (status, data) => res.status(status).json(data);
  const error = (status, message) => send(status, { error: message });
  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
    const action = req.method === "GET" ? new URL(req.url, "http://localhost").searchParams.get("action") : body.action;
    const auth = String(req.headers.authorization || "").match(/^Bearer pvacct:([^:]+):([a-f0-9]{40})$/);
    const username = String(auth?.[1] || body.username || "").trim().toLowerCase();
    const password = body.password;
    if (!usernamePattern.test(username)) return error(400, "Inserisci un nome utente valido con suffisso @via.");
    const slot = `accounts-v1:${digest(username)}`;
    const publicAction = req.method === "POST" && ["register", "login", "reset"].includes(action);
    if (publicAction) {
      const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "unknown").split(",")[0];
      if (limited(`ip:${ip}`, 16)) return error(429, "Troppi tentativi. Riprova tra un minuto.");
      if (typeof password !== "string" || password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        return error(400, "Usa da 8 a 72 caratteri, con almeno una lettera e un numero.");
    } else if (!auth) {
      return error(401, "Accedi di nuovo.");
    }

    const previous = await readAccess(slot);
    const user = previous ? structuredClone(previous.data) : null;
    const save = async next => await writeAccess(slot, next, previous);
    const retry = () => error(409, "L’account è stato aggiornato. Riprova.");
    if (publicAction && action === "register") {
      if (user && !user.deleted) return error(409, "Questo nome utente è già in uso.");
      const recoveryCode = random();
      const next = { username, ...await credentials(password), recovery: digest(recoveryCode), sessions: [], trips: [] };
      const login = session(next);
      return await save(next) ? send(201, payload(next, { ...login, recoveryCode })) : retry();
    }
    if (!user || user.deleted) return error(401, "Dati di accesso o recupero non validi.");
    if (publicAction && action === "login") {
      if (!await verify(password, user)) return error(401, "Nome utente o password non corretti.");
      const login = session(user);
      return await save(user) ? send(200, payload(user, login)) : retry();
    }
    if (publicAction && action === "reset") {
      const code = typeof body.code === "string" ? body.code.toLowerCase().replace(/[\s-]/g, "") : "";
      if (!/^[a-f0-9]{40}$/.test(code) || !timingSafeEqual(Buffer.from(digest(code), "hex"), Buffer.from(user.recovery, "hex")))
        return error(401, "Nome utente o codice di recupero non corretti.");
      const recoveryCode = random();
      Object.assign(user, await credentials(password), { recovery: digest(recoveryCode) });
      const login = session(user, true);
      return await save(user) ? send(200, payload(user, { ...login, recoveryCode })) : retry();
    }
    const active = user.sessions.find(s => s.hash === digest(auth[2]) && s.expiresAt > Date.now());
    if (!active) return error(401, "Sessione scaduta. Accedi di nuovo.");
    if (req.method === "GET" && action === "me") return send(200, payload(user, { expiresAt: active.expiresAt }));
    if (req.method === "PUT" && action === "save-trips") {
      user.trips = cleanTrips(body.trips);
      return await save(user) ? send(200, { trips: user.trips }) : retry();
    }
    if (req.method === "POST" && action === "logout") {
      user.sessions = user.sessions.filter(s => s !== active);
      return await save(user) ? send(200, { ok: true }) : retry();
    }
    if (req.method === "POST" && action === "delete-account") {
      if (typeof password !== "string" || password.length > 72 || !await verify(password, user))
        return error(401, "Credenziali non corrette.");
      return await save({ deleted: true }) ? send(200, { ok: true }) : retry();
    }
    return error(404, "Operazione non disponibile.");
  } catch (err) {
    return err instanceof SyntaxError ? error(400, "Dati non validi.") : error(503, "Servizio account non disponibile. Riprova.");
  }
}
