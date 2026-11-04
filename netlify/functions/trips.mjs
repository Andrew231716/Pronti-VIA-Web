/**
 * Trips API with Supabase proxy + Blobs/file KV fallback.
 * When Supabase is down, durable store keeps create/get/put working for Pages clients.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createKv } from "./_store.mjs";
import {
  assertMutationAllowed,
  permissionForMutation,
  roleMapFromTrip,
} from "../../lib/roles.mjs";
import { corsHeadersFor as buildCors } from "../../lib/cors.mjs";

const TRIPS_BASE =
  "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";

function corsHeadersFor(event) {
  return buildCors(event, {
    methods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    headers: "Content-Type, Authorization, X-Pronti-Member-Id",
  });
}

function actorMemberId(event, body) {
  const header =
    event.headers?.["x-pronti-member-id"] ||
    event.headers?.["X-Pronti-Member-Id"] ||
    "";
  const fromBody = body?.actorMemberId || body?.memberId || "";
  return String(header || fromBody || "").trim();
}

let corsHeaders = corsHeadersFor(null);

function persistenceFlags(saved) {
  const backend = saved?.backend || "store";
  const memoryOnly = backend === "memory";
  return {
    source: backend,
    local: memoryOnly,
    durable: !memoryOnly,
  };
}

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
    const persist = persistenceFlags(saved);
    return json(200, {
      id: newId,
      key,
      viewToken,
      trip: record.trip,
      revision: 1,
      canEdit: true,
      ...persist,
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
    const memberId = actorMemberId(event, body);
    const perm = permissionForMutation(method, {
      trip: nextTrip,
      __prevRoles: record.trip?.meta?.roles,
    });
    const gate = assertMutationAllowed(record.trip, memberId, perm);
    if (!gate.ok) {
      return json(403, {
        error: gate.error || "Operazione non autorizzata per il tuo ruolo.",
        role: gate.role,
        permission: gate.permission,
      });
    }
    const serverRev = Number(record.revision) || 1;
    const clientRev = Number(body.revision);
    // Optimistic lock: reject stale PUTs so concurrent saves don't silently clobber.
    if (Number.isFinite(clientRev) && clientRev !== serverRev) {
      return json(409, {
        error:
          "Versione non aggiornata. Ricarica e riprova: le modifiche più recenti non sono state sovrascritte.",
        id,
        key: record.key,
        viewToken: record.viewToken,
        trip: record.trip,
        revision: serverRev,
        canEdit: true,
        local: false,
        source: "store",
      });
    }
    // Merge meta; when actor is declared without "roles" permission, keep existing roles.
    const rolesGate = assertMutationAllowed(record.trip, memberId, "roles");
    const mergedMeta = {
      ...(record.trip?.meta && typeof record.trip.meta === "object" ? record.trip.meta : {}),
      ...(nextTrip.meta && typeof nextTrip.meta === "object" ? nextTrip.meta : {}),
    };
    if (memberId && !rolesGate.ok) {
      mergedMeta.roles = roleMapFromTrip(record.trip);
    }
    nextTrip.meta = mergedMeta;
    const updated = {
      ...record,
      trip: { ...nextTrip, budget: typeof nextTrip.budget === "number" ? nextTrip.budget : 0 },
      revision: serverRev + 1,
      updated: new Date().toISOString(),
      source: "store",
    };
    const saved = await tripsKv.setJSON(`trip:${id}`, updated);
    const persist = persistenceFlags(saved);
    return json(200, {
      id,
      key: record.key,
      viewToken: record.viewToken,
      trip: updated.trip,
      revision: updated.revision,
      canEdit: true,
      ...persist,
    });
  }

  if (method === "DELETE") {
    if (!canEdit) return json(403, { error: "Solo chi ha la chiave di modifica può eliminare il viaggio." });
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      body = {};
    }
    const memberId = actorMemberId(event, body);
    const gate = assertMutationAllowed(record.trip, memberId, "delete");
    if (!gate.ok) {
      return json(403, {
        error: gate.error || "Solo il proprietario può eliminare il viaggio.",
        role: gate.role,
      });
    }
    await tripsKv.del(`trip:${id}`);
    return json(200, { ok: true, id, deleted: true });
  }

  return json(405, { error: "Metodo non supportato." });
}

export async function handler(event) {
  corsHeaders = corsHeadersFor(event);
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
