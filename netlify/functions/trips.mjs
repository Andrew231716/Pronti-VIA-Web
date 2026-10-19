/**
 * Trips API with Supabase proxy + Blobs/file KV fallback.
 * When Supabase is down, durable store keeps create/get/put working for Pages clients.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createKv } from "./_store.mjs";

const TRIPS_BASE =
  "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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

const tripsKv = createKv("pronti-via-trips");

function tripsPath(event) {
  const candidates = [
    event.path,
    event.rawPath,
    event.headers?.["x-forwarded-url"],
    event.headers?.["x-original-url"],
    event.headers?.["x-netlify-original-pathname"],
    event.rawUrl,
  ]
    .filter(Boolean)
    .map(String);

  let rest = "";
  for (const raw of candidates) {
    let pathOnly = raw;
    try {
      if (/^https?:/i.test(raw)) pathOnly = new URL(raw).pathname;
    } catch {
      /* keep */
    }
    const matched = pathOnly.match(
      /\/(?:\.netlify\/functions\/trips|api\/trips|api)(\/.*)?$/i
    );
    if (matched) {
      rest = matched[1] || "";
      break;
    }
  }

  const splat = event.pathParameters?.splat || event.params?.splat;
  if ((!rest || rest === "/") && splat) {
    rest = Array.isArray(splat)
      ? `/${splat.join("/")}`
      : `/${String(splat).replace(/^\/+/, "")}`;
  }
  if (!rest || rest === "/") return "/trips";
  if (!rest.startsWith("/")) rest = `/${rest}`;
  if (rest === "/trips" || rest.startsWith("/trips/")) return rest;
  return `/trips${rest}`;
}

function getBearer(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function normalizeTripBody(body) {
  if (body?.trip && typeof body.trip === "object" && !Array.isArray(body.trip)) {
    return body.trip;
  }
  return body && typeof body === "object" ? body : {};
}

async function proxySupabase(event, path) {
  const target = `${TRIPS_BASE}${path}${event.rawQuery ? `?${event.rawQuery}` : ""}`;
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (auth) headers.Authorization = auth;

  const upstream = await fetch(target, {
    method: event.httpMethod,
    headers,
    body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
  });
  const text = await upstream.text();
  return {
    statusCode: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
    body: text,
  };
}

async function storeHandler(event, path) {
  const method = event.httpMethod.toUpperCase();
  const parts = path.replace(/^\/trips\/?/, "").split("/").filter(Boolean);
  const id = parts[0] ? decodeURIComponent(parts[0]) : "";
  const token = getBearer(event);

  if (method === "POST" && !id) {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Dati viaggio non validi." });
    }
    const trip = normalizeTripBody(body);
    const newId = randomUUID();
    const key = randomHex(32);
    const viewToken = randomHex(32);
    const record = {
      id: newId,
      key,
      viewToken,
      trip: { ...trip, budget: typeof trip.budget === "number" ? trip.budget : 0 },
      revision: 1,
      updated: new Date().toISOString(),
      source: "store",
    };
    const saved = await tripsKv.setJSON(`trip:${newId}`, record);
    return json(200, {
      id: newId,
      key,
      viewToken,
      trip: record.trip,
      revision: 1,
      canEdit: true,
      local: false,
      source: saved.backend || "store",
    });
  }

  if (!id) return json(404, { error: "Viaggio non trovato." });

  const record = await tripsKv.getJSON(`trip:${id}`);
  if (!record?.trip) return json(404, { error: "Viaggio non trovato." });

  const canEdit = token && token === record.key;
  const canView = canEdit || (token && token === record.viewToken);
  if (!canView) return json(401, { error: "Link non valido o scaduto." });

  if (method === "GET") {
    return json(200, {
      id: record.id,
      key: canEdit ? record.key : undefined,
      viewToken: record.viewToken,
      trip: record.trip,
      revision: record.revision || 1,
      canEdit: !!canEdit,
      local: false,
      source: "store",
    });
  }

  if ((method === "PUT" || method === "PATCH") && canEdit) {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Dati viaggio non validi." });
    }
    const nextTrip = normalizeTripBody(body);
    const revision = Number(body.revision) || record.revision || 1;
    const updated = {
      ...record,
      trip: { ...nextTrip, budget: typeof nextTrip.budget === "number" ? nextTrip.budget : 0 },
      revision: revision + 1,
      updated: new Date().toISOString(),
      source: "store",
    };
    await tripsKv.setJSON(`trip:${id}`, updated);
    return json(200, {
      id,
      key: record.key,
      viewToken: record.viewToken,
      trip: updated.trip,
      revision: updated.revision,
      canEdit: true,
      local: false,
      source: "store",
    });
  }

  return json(405, { error: "Metodo non supportato." });
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const path = tripsPath(event);

  // Prefer Supabase when healthy; otherwise durable Blobs fallback.
  try {
    const proxied = await proxySupabase(event, path);
    if (proxied.statusCode < 500) return proxied;
  } catch {
    /* fall through */
  }

  try {
    return await storeHandler(event, path);
  } catch (err) {
    return json(502, {
      error: "Proxy viaggi non disponibile.",
      detail: String(err?.message || err || ""),
    });
  }
}
