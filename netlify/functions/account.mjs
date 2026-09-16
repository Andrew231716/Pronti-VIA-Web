import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 365 * 10; // ~10 years; client also remembers in localStorage
const MAX_TRIPS = 40;

function getAccountStore() {
  const siteID =
    process.env.SITE_ID ||
    process.env.NETLIFY_SITE_ID ||
    process.env.BLOBS_SITE_ID;
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_API_TOKEN ||
    process.env.BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name: "pronti-via-accounts", siteID, token });
  }
  return getStore("pronti-via-accounts");
}

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateUsername(username) {
  if (username.length < 3 || username.length > 32) {
    return "Il nome utente deve avere tra 3 e 32 caratteri.";
  }
  if (!/^[a-z0-9._ -]+$/i.test(username)) {
    return "Usa solo lettere, numeri, spazi, punti, _ e -.";
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 4 || password.length > 72) {
    return "La password deve avere almeno 4 caratteri.";
  }
  return null;
}

function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function verifyPassword(password, saltHex, hashHex) {
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getBearer(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function sanitizeTrips(trips) {
  if (!Array.isArray(trips)) return [];
  const seen = new Set();
  const out = [];
  for (const item of trips) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "Viaggio";
    if (!id || !key || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, key, title: title.slice(0, 120) });
    if (out.length >= MAX_TRIPS) break;
  }
  return out;
}

async function getSession(store, token) {
  if (!token) return null;
  const session = await store.get(`session:${token}`, { type: "json" });
  if (!session?.username) return null;
  // Keep long-lived sessions; refresh expiry on use.
  if (session.expiresAt && Date.now() > session.expiresAt) {
    await store.delete(`session:${token}`);
    return null;
  }
  try {
    await store.setJSON(`session:${token}`, {
      username: session.username,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  } catch {
    /* ignore refresh failures */
  }
  return session;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      },
      body: "",
    };
  }

  const store = getAccountStore();
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { error: "JSON non valido." });
    }
  }

  const action =
    body.action ||
    event.queryStringParameters?.action ||
    (event.httpMethod === "GET" ? "me" : event.httpMethod === "PUT" ? "save-trips" : "");

  try {
    if (event.httpMethod === "POST" && action === "register") {
      const username = normalizeUsername(body.username);
      const password = body.password;
      const userError = validateUsername(username);
      if (userError) return json(400, { error: userError });
      const passError = validatePassword(password);
      if (passError) return json(400, { error: passError });

      const existing = await store.get(`user:${username}`, { type: "json" });
      if (existing) return json(409, { error: "Questo nome utente è già in uso." });

      const { salt, hash } = hashPassword(password);
      const displayName =
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName.trim().slice(0, 40)
          : username;

      await store.setJSON(`user:${username}`, {
        username,
        displayName,
        salt,
        hash,
        createdAt: new Date().toISOString(),
      });
      await store.setJSON(`trips:${username}`, []);

      const token = randomBytes(32).toString("hex");
      await store.setJSON(`session:${token}`, {
        username,
        expiresAt: Date.now() + SESSION_TTL_MS,
      });

      return json(201, {
        token,
        user: { username, displayName },
        trips: [],
      });
    }

    if (event.httpMethod === "POST" && action === "login") {
      const username = normalizeUsername(body.username);
      const password = body.password;
      if (!username || !password) {
        return json(400, { error: "Inserisci nome utente e password." });
      }

      const user = await store.get(`user:${username}`, { type: "json" });
      if (!user?.salt || !user?.hash || !verifyPassword(password, user.salt, user.hash)) {
        return json(401, { error: "Nome utente o password non corretti." });
      }

      const token = randomBytes(32).toString("hex");
      await store.setJSON(`session:${token}`, {
        username: user.username,
        expiresAt: Date.now() + SESSION_TTL_MS,
      });
      const trips = sanitizeTrips(await store.get(`trips:${username}`, { type: "json" }));

      return json(200, {
        token,
        user: { username: user.username, displayName: user.displayName || user.username },
        trips,
      });
    }

    if (event.httpMethod === "POST" && action === "logout") {
      const token = getBearer(event);
      if (token) await store.delete(`session:${token}`);
      return json(200, { ok: true });
    }

    if (event.httpMethod === "GET" && (action === "me" || action === "trips")) {
      const token = getBearer(event);
      const session = await getSession(store, token);
      if (!session) return json(401, { error: "Sessione scaduta. Accedi di nuovo." });

      const user = await store.get(`user:${session.username}`, { type: "json" });
      if (!user) return json(401, { error: "Account non trovato." });

      const trips = sanitizeTrips(await store.get(`trips:${session.username}`, { type: "json" }));
      return json(200, {
        user: { username: user.username, displayName: user.displayName || user.username },
        trips,
      });
    }

    if (event.httpMethod === "PUT" && (action === "save-trips" || !action)) {
      const token = getBearer(event);
      const session = await getSession(store, token);
      if (!session) return json(401, { error: "Sessione scaduta. Accedi di nuovo." });

      const trips = sanitizeTrips(body.trips);
      await store.setJSON(`trips:${session.username}`, trips);
      return json(200, { trips });
    }

    return json(404, { error: "Azione non trovata." });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Errore del server account. Riprova." });
  }
}
