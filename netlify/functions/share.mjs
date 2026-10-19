/**
 * First-party share snapshots (Netlify Blobs).
 * POST { record } -> { key: "n:<id>" }
 * GET  /api/share/:id -> record JSON
 */
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(status, body) {
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

function getShareStore() {
  const siteID =
    process.env.SITE_ID || process.env.NETLIFY_SITE_ID || process.env.BLOBS_SITE_ID;
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_API_TOKEN ||
    process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "pronti-via-shares", siteID, token });
  }
  return getStore("pronti-via-shares");
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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const store = getShareStore();
    const method = event.httpMethod.toUpperCase();

    if (method === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Payload non valido." });
      }
      const record = body.record || body;
      if (!record || typeof record !== "object") {
        return json(400, { error: "Manca il record del viaggio." });
      }
      const id = randomBytes(9).toString("base64url");
      await store.setJSON(`share:${id}`, {
        ...record,
        publishedAt: new Date().toISOString(),
      });
      return json(201, { key: id, ref: `n:${id}` });
    }

    if (method === "GET") {
      const id = shareIdFromPath(event).replace(/^n:/, "");
      if (!id) return json(400, { error: "Manca l'id dello snapshot." });
      const record = await store.get(`share:${id}`, { type: "json" });
      if (!record) return json(404, { error: "Snapshot non trovato o scaduto." });
      return json(200, record);
    }

    return json(405, { error: "Metodo non supportato." });
  } catch (err) {
    return json(502, {
      error: "Servizio condivisione non disponibile.",
      detail: String(err?.message || err || ""),
    });
  }
}
