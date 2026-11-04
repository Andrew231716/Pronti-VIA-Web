/**
 * First-party share snapshots (Netlify Blobs, else file/memory KV).
 * POST { record, inviteCode?, ttlDays? } + optional Bearer edit key
 * GET  /api/share/:id -> public-safe record (edit key stripped)
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createKv } from "./_store.mjs";

const ALLOWED_ORIGINS = [
  "https://andrew231716.github.io",
  "https://pronti-via-k7es.netlify.app",
];

function corsHeadersFor(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allow =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
      ? origin || ALLOWED_ORIGINS[0]
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const shareKv = createKv("pronti-via-shares");
const DEFAULT_TTL_DAYS = 90;
const MAX_TTL_DAYS = 365;
const MAX_BODY_BYTES = 900_000;
const rateBuckets = new Map();

function rateLimit(ip, max = 30) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now - b.start > 15 * 60 * 1000) {
    b = { start: now, count: 0 };
    rateBuckets.set(ip, b);
  }
  b.count += 1;
  return b.count <= max;
}

function clientIp(event) {
  const xf = event.headers?.["x-forwarded-for"] || event.headers?.["X-Forwarded-For"] || "";
  return String(xf).split(",")[0].trim() || "unknown";
}

function json(status, body, corsHeaders) {
  return {
    statusCode: status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function shareIdFromPath(event) {
  const candidates = [
    event.path,
    event.rawPath,
    event.rawUrl,
    event.headers?.["x-forwarded-url"],
  ]
    .filter(Boolean)
    .map(String);
  for (const raw of candidates) {
    let pathOnly = raw;
    try {
      if (/^https?:/i.test(raw)) pathOnly = new URL(raw).pathname;
    } catch {
      /* keep */
    }
    const m = pathOnly.match(/\/(?:\.netlify\/functions\/share|api\/share)\/?([^/?#]+)?/i);
    if (m) return decodeURIComponent(m[1] || "");
  }
  const splat = event.pathParameters?.splat || event.params?.splat;
  if (splat) return Array.isArray(splat) ? splat[0] : String(splat);
  return "";
}

function getBearer(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length || aa.length === 0) return false;
  try {
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

/** Public GET payload: never expose edit key. */
function publicRecord(record) {
  if (!record || typeof record !== "object") return record;
  const { key: _k, editKey: _e, ...rest } = record;
  return {
    ...rest,
    key: "",
    canEdit: false,
    preview: {
      title: rest.trip?.title || rest.title || "Viaggio",
      destination: rest.trip?.destination || "",
      start: rest.trip?.start || "",
      end: rest.trip?.end || "",
      members: Array.isArray(rest.trip?.members)
        ? rest.trip.members.map((m) => ({ name: m?.name || "" }))
        : [],
    },
  };
}

export async function handler(event) {
  const corsHeaders = corsHeadersFor(event);
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const method = event.httpMethod.toUpperCase();
    const ip = clientIp(event);

    if (method === "POST") {
      if (!rateLimit(ip)) {
        return json(429, { error: "Troppe condivisioni. Riprova più tardi." }, corsHeaders);
      }
      if ((event.body || "").length > MAX_BODY_BYTES) {
        return json(413, { error: "Snapshot troppo grande." }, corsHeaders);
      }
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Payload non valido." }, corsHeaders);
      }
      const record = body.record || body;
      if (!record || typeof record !== "object") {
        return json(400, { error: "Manca il record del viaggio." }, corsHeaders);
      }

      const inviteRaw = String(body.inviteCode || record.code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const inviteOk =
        /^[A-Z0-9]{6}$/.test(inviteRaw) && (record.kind === "invite" || body.inviteCode);
      const id = inviteOk ? `inv-${inviteRaw}` : randomBytes(18).toString("base64url");

      if (inviteOk) {
        const existing = await shareKv.getJSON(`share:${id}`);
        if (existing) {
          const bearer = getBearer(event);
          const ownerKey = existing.revokeToken || existing.key || existing.editKey || "";
          if (!bearer || !ownerKey || !safeEqual(bearer, ownerKey)) {
            return json(
              409,
              { error: "Codice invito già in uso. Scegline un altro o autentica la revoca." },
              corsHeaders
            );
          }
        }
      }

      const ttlDays = Math.min(
        MAX_TTL_DAYS,
        Math.max(1, Number(body.ttlDays) || DEFAULT_TTL_DAYS)
      );
      const expiresAt = new Date(Date.now() + ttlDays * 86400000).toISOString();
      const revokeToken = randomBytes(24).toString("hex");
      const stored = {
        ...record,
        ...(inviteOk ? { kind: "invite", code: inviteRaw } : {}),
        // Keep edit key only server-side for revoke/overwrite proof; not returned on GET.
        key: record.key || body.tripKey || "",
        revokeToken,
        publishedAt: new Date().toISOString(),
        expiresAt,
        ttlDays,
      };
      const saved = await shareKv.setJSON(`share:${id}`, stored);
      return json(
        201,
        {
          key: id,
          ref: `n:${id}`,
          expiresAt,
          revokeToken,
          source: saved.backend || "store",
          local: saved.backend === "memory",
        },
        corsHeaders
      );
    }

    if (method === "GET") {
      const id = shareIdFromPath(event).replace(/^n:/, "");
      if (!id) return json(400, { error: "Manca l'id dello snapshot." }, corsHeaders);
      const record = await shareKv.getJSON(`share:${id}`);
      if (!record) return json(404, { error: "Snapshot non trovato o scaduto." }, corsHeaders);
      if (record.expiresAt && Date.now() > Date.parse(record.expiresAt)) {
        await shareKv.del(`share:${id}`);
        return json(404, { error: "Snapshot scaduto." }, corsHeaders);
      }
      const bearer = getBearer(event);
      const owner =
        bearer &&
        (safeEqual(bearer, record.revokeToken) ||
          safeEqual(bearer, record.key) ||
          safeEqual(bearer, record.editKey));
      if (owner) {
        return json(200, { ...record, canEdit: true }, corsHeaders);
      }
      return json(200, publicRecord(record), corsHeaders);
    }

    if (method === "DELETE") {
      const id = shareIdFromPath(event).replace(/^n:/, "");
      if (!id) return json(400, { error: "Manca l'id dello snapshot." }, corsHeaders);
      const record = await shareKv.getJSON(`share:${id}`);
      if (!record) return json(404, { error: "Snapshot non trovato." }, corsHeaders);
      const bearer = getBearer(event);
      const ok =
        bearer &&
        (safeEqual(bearer, record.revokeToken) ||
          safeEqual(bearer, record.key) ||
          safeEqual(bearer, record.editKey));
      if (!ok) return json(403, { error: "Revoca non autorizzata." }, corsHeaders);
      await shareKv.del(`share:${id}`);
      return json(200, { ok: true, deleted: id }, corsHeaders);
    }

    return json(405, { error: "Metodo non supportato." }, corsHeaders);
  } catch (err) {
    return json(
      502,
      {
        error: "Servizio condivisione non disponibile.",
        detail: String(err?.message || err || ""),
      },
      corsHeadersFor(event)
    );
  }
}
