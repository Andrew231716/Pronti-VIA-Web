/**
 * Client fallback when /api/* is not reverse-proxied (e.g. GitHub Pages).
 * Places → Photon; trips → CORS-enabled Netlify proxy, then durable localStorage.
 * v=20261029a — account sync via Netlify; live search; share via Blobs + bytebin.
 */
(() => {
  const TRIPS_BASE =
    "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";
  // Free production path: Netlify Functions + Blobs (no paid tunnel).
  const NETLIFY_API = "https://pronti-via-k7es.netlify.app";
  const TRIPS_PROXIES = []; // dead trycloudflare tunnels removed
  const LOCAL_TRIPS_KEY = "viavia-local-trips-v1";
  const LOCAL_FILES_KEY = "viavia-local-trip-files-v1";
  const PRIVATE_BUDGET_KEY = "viavia-private-budget-v1";
  const SHARE_BLOBS_KEY = "viavia-share-blobs-v1";
  const MAX_TRIP_FILES = 50;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const BYTEBIN = "https://bytebin.lucko.me";
  const PER_TRY_MS = 8000;
  // Serialize trip writes so join / preventivo / React saves do not clobber each other.
  let tripWriteChain = Promise.resolve();
  function enqueueTripWrite(task) {
    const run = tripWriteChain.then(task, task);
    tripWriteChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
  window.__pvEnqueueTripWrite = enqueueTripWrite;

  /* ---- Shared persistence honesty (mirrors lib/sync-state.mjs) ---- */
  const OUTBOX_KEY = "viavia-platform-outbox-v1";
  const SAVE_MSG = {
    SERVER: "Salvato e sincronizzato",
    LOCAL: "Salvato su questo dispositivo. In attesa di sincronizzazione",
    ERROR: "Salvataggio non riuscito",
    CONFLICT:
      "Versione non aggiornata. Ricarica e riprova: le modifiche più recenti non sono state sovrascritte.",
    CREATE_SERVER: "Viaggio creato e sincronizzato. Conserva il link per ritrovarlo.",
    CREATE_LOCAL:
      "Viaggio creato su questo dispositivo. In attesa di sincronizzazione. Conserva il link.",
  };

  function classifyPersistence(data = {}) {
    if (data && data.ok === false) return "error";
    if (data.local === true || String(data.source || "").toLowerCase() === "memory") return "local";
    if (data.durable === false) return "local";
    const src = String(data.source || "").toLowerCase();
    if (src === "blobs" || src === "file" || src === "supabase" || src === "store") return "server";
    if (data.local === false) return "server";
    return "pending";
  }

  function saveToastFromResponse(data = {}, { create = false } = {}) {
    const status = classifyPersistence(data || {});
    if (create) {
      return status === "local" || status === "pending" ? SAVE_MSG.CREATE_LOCAL : SAVE_MSG.CREATE_SERVER;
    }
    if (status === "local" || status === "pending") return SAVE_MSG.LOCAL;
    if (status === "error") return SAVE_MSG.ERROR;
    return SAVE_MSG.SERVER;
  }

  function readOutbox() {
    try {
      const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }
  function writeOutbox(q) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify((q || []).slice(0, 100)));
    } catch {
      /* quota */
    }
  }
  function enqueueOutboxItem(item) {
    const q = readOutbox().filter(
      (x) => !(x.tripId && item.tripId && x.tripId === item.tripId && x.type === item.type)
    );
    q.unshift({
      id: item.id || `op-${Date.now().toString(36)}`,
      type: item.type || "trip-put",
      tripId: item.tripId || "",
      key: item.key || "",
      revision: item.revision,
      payload: item.payload ?? null,
      createdAt: item.createdAt || new Date().toISOString(),
      attempts: Number(item.attempts) || 0,
    });
    writeOutbox(q);
    try {
      window.dispatchEvent(new CustomEvent("pv-outbox-changed", { detail: { count: q.length } }));
    } catch {
      /* ignore */
    }
  }
  function clearOutboxTrip(tripId, type = "trip-put") {
    const q = readOutbox().filter((x) => !(x.tripId === tripId && x.type === type));
    writeOutbox(q);
    try {
      window.dispatchEvent(new CustomEvent("pv-outbox-changed", { detail: { count: q.length } }));
    } catch {
      /* ignore */
    }
  }

  async function flushOutbox() {
    if (!navigator.onLine) return { flushed: 0, left: readOutbox().length };
    let q = readOutbox();
    let flushed = 0;
    const left = [];
    for (const item of q) {
      if (item.type !== "trip-put" || !item.tripId || !item.key || !item.payload) {
        left.push(item);
        continue;
      }
      try {
        const res = await originalFetch(`/api/trips/${encodeURIComponent(item.tripId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${item.key}`,
          },
          body: JSON.stringify({
            trip: item.payload,
            revision: item.revision,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          left.push({ ...item, attempts: (item.attempts || 0) + 1, lastError: "conflict" });
          try {
            window.dispatchEvent(
              new CustomEvent("pv-save-status", {
                detail: { tripId: item.tripId, conflict: true, message: SAVE_MSG.CONFLICT },
              })
            );
          } catch {
            /* ignore */
          }
          continue;
        }
        if (!res.ok) {
          left.push({ ...item, attempts: (item.attempts || 0) + 1, lastError: data.error || "fail" });
          continue;
        }
        const ephemeral =
          data.local === true || String(data.source || "").toLowerCase() === "memory";
        if (ephemeral) {
          left.push({ ...item, attempts: (item.attempts || 0) + 1, lastError: "still-local" });
          continue;
        }
        flushed += 1;
        try {
          window.dispatchEvent(
            new CustomEvent("pv-save-status", {
              detail: {
                tripId: item.tripId,
                local: false,
                source: data.source || "server",
                message: SAVE_MSG.SERVER,
              },
            })
          );
        } catch {
          /* ignore */
        }
      } catch {
        left.push({ ...item, attempts: (item.attempts || 0) + 1 });
      }
    }
    writeOutbox(left);
    try {
      window.dispatchEvent(new CustomEvent("pv-outbox-changed", { detail: { count: left.length } }));
    } catch {
      /* ignore */
    }
    return { flushed, left: left.length };
  }

  function noteWritePersistence(method, tripId, key, data, tripPayload, revision) {
    if (!tripId) return;
    const ephemeral =
      !data ||
      data.local === true ||
      String(data.source || "").toLowerCase() === "memory" ||
      data.durable === false;
    if ((method === "PUT" || method === "PATCH") && ephemeral && tripPayload) {
      enqueueOutboxItem({
        type: "trip-put",
        tripId,
        key: key || "",
        revision,
        payload: tripPayload,
      });
    }
    if ((method === "PUT" || method === "PATCH" || method === "POST") && data && !ephemeral) {
      clearOutboxTrip(tripId, "trip-put");
    }
  }

  window.__pvClassifyPersistence = classifyPersistence;
  window.__pvSaveToast = (data) => saveToastFromResponse(data, { create: false });
  window.__pvCreateToast = (data) => saveToastFromResponse(data, { create: true });
  window.__pvSaveMsg = SAVE_MSG;
  window.__pvFlushOutbox = flushOutbox;
  window.__pvReadOutbox = readOutbox;
  window.addEventListener("online", () => {
    void flushOutbox();
  });

  const originalFetch = window.fetch.bind(window);
  const onGitHubPages = /\.github\.io$/i.test(location.hostname);
  const sameOriginApiProxy =
    /\.trycloudflare\.com$/i.test(location.hostname) ||
    /\.vercel\.app$/i.test(location.hostname) ||
    /\.netlify\.app$/i.test(location.hostname) ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  function wallTimeout(ms, label) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error(label || "timeout");
        err.name = "TimeoutError";
        reject(err);
      }, ms);
    });
  }

  function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  function readLocalTrips() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_TRIPS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeLocalTrips(db) {
    try {
      localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify(db));
    } catch {
      /* quota */
    }
  }

  function budgetOwner() {
    try {
      const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
      const user = String(session?.user?.username || "anon")
        .trim()
        .toLowerCase();
      return user || "anon";
    } catch {
      return "anon";
    }
  }

  function privateBudgetSlot(tripId) {
    return `${budgetOwner()}::${tripId}`;
  }

  function readPrivateBudgets() {
    try {
      const raw = JSON.parse(localStorage.getItem(PRIVATE_BUDGET_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writePrivateBudgets(db) {
    try {
      localStorage.setItem(PRIVATE_BUDGET_KEY, JSON.stringify(db));
    } catch {
      /* quota */
    }
  }

  function clearPrivateBudget(tripId) {
    if (!tripId) return;
    try {
      const db = readPrivateBudgets();
      const slot = privateBudgetSlot(tripId);
      if (slot in db) {
        delete db[slot];
        writePrivateBudgets(db);
      }
    } catch {
      /* ignore */
    }
  }

  function removeRecentLink(tripId) {
    if (!tripId) return;
    try {
      const raw = JSON.parse(localStorage.getItem("viavia-recent-links-v1") || "[]");
      if (!Array.isArray(raw)) return;
      localStorage.setItem(
        "viavia-recent-links-v1",
        JSON.stringify(raw.filter((e) => e && e.id !== tripId).slice(0, 20))
      );
    } catch {
      /* ignore */
    }
  }

  function purgeLocalTrip(tripId) {
    if (!tripId) return;
    const db = readLocalTrips();
    if (db[tripId]) {
      delete db[tripId];
      writeLocalTrips(db);
    }
    clearPrivateBudget(tripId);
    removeRecentLink(tripId);
  }

  window.__pvPurgeLocalTrip = purgeLocalTrip;

  function getPrivateBudget(tripId) {
    if (!tripId) return null;
    const v = readPrivateBudgets()[privateBudgetSlot(tripId)];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  }

  function setPrivateBudget(tripId, cents) {
    if (!tripId || !Number.isFinite(cents) || cents < 0) return;
    const db = readPrivateBudgets();
    db[privateBudgetSlot(tripId)] = Math.round(cents);
    writePrivateBudgets(db);
  }

  /** Budget stays on-device; shared trip always stores 0. */
  function applyPrivateBudgetView(tripId, trip) {
    if (!trip || !tripId) return trip;
    const next = { ...trip };
    const priv = getPrivateBudget(tripId);
    if (priv == null && Number(next.budget) > 0) {
      setPrivateBudget(tripId, Number(next.budget));
      next.budget = Number(next.budget);
      return next;
    }
    next.budget = priv != null ? priv : 0;
    return next;
  }

  function takeBudgetPrivate(tripId, trip) {
    if (!trip || !tripId) return trip;
    const next = { ...trip };
    // Only migrate a positive shared budget. budget === 0 means
    // "clear shared copy; keep the existing private value".
    if (typeof next.budget === "number" && Number.isFinite(next.budget) && next.budget > 0) {
      setPrivateBudget(tripId, next.budget);
    }
    next.budget = 0;
    return next;
  }

  async function rewriteTripWriteInit(pathname, init = {}) {
    const method = (init.method || "GET").toUpperCase();
    if (method !== "POST" && method !== "PUT" && method !== "PATCH") return init;
    if (!init.body) return init;
    let body;
    try {
      body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    } catch {
      return init;
    }
    const idFromPath = decodeURIComponent(pathname.replace(/^\/api\/trips\/?/, "").split("/")[0] || "");
    if (method === "POST" && body && !body.trip) {
      // create: body is the trip itself — stash budget privately after we know the id
      rewriteTripWriteInit._pendingBudget =
        typeof body.budget === "number" && Number.isFinite(body.budget) && body.budget > 0
          ? body.budget
          : null;
      return { ...init, body: JSON.stringify({ ...body, budget: 0 }) };
    }
    if (body?.trip) {
      const id = idFromPath || body.id || "";
      const trip = takeBudgetPrivate(id, body.trip);
      return { ...init, body: JSON.stringify({ ...body, trip }) };
    }
    return init;
  }

  async function withPrivateBudgetResponse(res, tripIdHint) {
    if (!res || !res.ok) return res;
    try {
      const data = await res.clone().json();
      let changed = false;
      if (data?.trip) {
        const id = data.id || tripIdHint;
        if (
          id &&
          data.id &&
          typeof rewriteTripWriteInit._pendingBudget === "number" &&
          rewriteTripWriteInit._pendingBudget > 0
        ) {
          setPrivateBudget(data.id, rewriteTripWriteInit._pendingBudget);
          rewriteTripWriteInit._pendingBudget = null;
        }
        data.trip = applyPrivateBudgetView(id, data.trip);
        changed = true;
      }
      if (!changed) return res;
      return jsonResponse(res.status, data);
    } catch {
      return res;
    }
  }

  function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function bearerKey(init) {
    const headers = init.headers || {};
    let auth = "";
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      auth = headers.get("Authorization") || headers.get("authorization") || "";
    } else if (Array.isArray(headers)) {
      const hit = headers.find((h) => String(h[0]).toLowerCase() === "authorization");
      auth = hit ? hit[1] : "";
    } else {
      auth = headers.Authorization || headers.authorization || "";
    }
    const m = String(auth).match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim() : "";
  }

  function isEphemeralPersistence(data) {
    if (!data || typeof data !== "object") return false;
    if (data.local === true) return true;
    if (data.durable === false) return true;
    const src = String(data.source || "").toLowerCase();
    return src === "memory";
  }

  function tripPayloadFromInit(init) {
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (body?.trip && typeof body.trip === "object") return body.trip;
      if (body && typeof body === "object" && !Array.isArray(body)) return body;
    } catch {
      /* ignore */
    }
    return null;
  }

  function trackTripWriteResult(method, tripId, init, data) {
    const key = bearerKey(init);
    const tripPayload = tripPayloadFromInit(init);
    const rev = data?.revision ?? (typeof init?.body === "string"
      ? (() => {
          try {
            return JSON.parse(init.body).revision;
          } catch {
            return undefined;
          }
        })()
      : undefined);
    noteWritePersistence(method, tripId, key, data, tripPayload, rev);
  }

  function cacheTripRecord(id, record) {
    if (!id || !record?.trip) return;
    const db = readLocalTrips();
    // Never persist private budget into the shared/local trip blob.
    const sharedTrip = { ...record.trip, budget: 0 };
    const ephemeral = isEphemeralPersistence(record);
    db[id] = {
      id,
      key: record.key || db[id]?.key || "",
      viewToken: record.viewToken || db[id]?.viewToken || "",
      trip: sharedTrip,
      revision: record.revision || 1,
      canEdit: record.canEdit !== false,
      updated: record.updated || new Date().toISOString(),
      source: record.source || db[id]?.source || "",
      // Explicit durable cloud sync clears a prior local-only flag.
      // Memory/ephemeral backends must stay local:true so UI never claims cloud save.
      local: ephemeral
        ? true
        : record.local === false
          ? false
          : Boolean(record.local || db[id]?.local),
    };
    writeLocalTrips(db);
    try {
      window.dispatchEvent(
        new CustomEvent("pv-save-status", {
          detail: {
            tripId: id,
            local: db[id].local,
            source: db[id].source || (db[id].local ? "local" : "server"),
            revision: db[id].revision,
            at: Date.now(),
          },
        })
      );
    } catch {
      /* ignore */
    }
  }

  /** Seed trip from share-hash payload so recipients can open shared trips. */
  function readShareBlobMap() {
    try {
      const raw = JSON.parse(localStorage.getItem(SHARE_BLOBS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeShareBlobMap(db) {
    try {
      localStorage.setItem(SHARE_BLOBS_KEY, JSON.stringify(db));
    } catch {
      /* quota */
    }
  }

  function shareBlobSlot(tripId, shareKey) {
    return `${tripId}::${shareKey || ""}`;
  }

  function getCachedShareRef(tripId, shareKey) {
    const hit = readShareBlobMap()[shareBlobSlot(tripId, shareKey)];
    if (!hit?.ref) return "";
    // Invalidate when revision moved on.
    const rec = readLocalTrips()[tripId];
    if (rec && hit.revision && Number(hit.revision) !== Number(rec.revision || 1)) return "";
    return String(hit.ref);
  }

  function setCachedShareRef(tripId, shareKey, ref, revision) {
    if (!tripId || !ref) return;
    const db = readShareBlobMap();
    db[shareBlobSlot(tripId, shareKey)] = {
      ref,
      revision: revision || 1,
      updated: new Date().toISOString(),
    };
    writeShareBlobMap(db);
  }

  function slimShareRecord(record, shareKey) {
    const key = String(shareKey || "");
    const isEdit = Boolean(key && key === record.key);
    return {
      id: record.id,
      trip: { ...record.trip, budget: 0 },
      revision: record.revision || 1,
      updated: record.updated,
      viewToken: record.viewToken || "",
      key: isEdit ? record.key : "",
      canEdit: isEdit,
    };
  }

  function applySeededRecord(id, key, json) {
    if (!id || !json?.trip) return false;
    const db = readLocalTrips();
    const existing = db[id];
    const record = {
      id,
      key: json.key || existing?.key || "",
      viewToken: json.viewToken || existing?.viewToken || key || "",
      trip: { ...json.trip, budget: 0 },
      revision: json.revision || 1,
      canEdit: Boolean(json.canEdit || (json.key && json.key === key)),
      updated: json.updated || new Date().toISOString(),
      local: true,
    };
    if (!existing || Number(record.revision) >= Number(existing.revision || 0)) {
      db[id] = {
        ...record,
        key: record.key || existing?.key || "",
        viewToken: record.viewToken || existing?.viewToken || key || "",
      };
      writeLocalTrips(db);
      return true;
    }
    return Boolean(existing);
  }

  function encodeInlineSharePayload(record, shareKey) {
    try {
      const raw = JSON.stringify(slimShareRecord(record, shareKey));
      return (
        "i:" +
        btoa(unescape(encodeURIComponent(raw)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/g, "")
      );
    } catch {
      return "";
    }
  }

  function decodeInlineSharePayload(b64) {
    const pad = "===".slice((b64.length + 3) % 4);
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const raw = decodeURIComponent(escape(atob(norm)));
    return JSON.parse(raw);
  }

  async function publishNetlifyShare(slim) {
    const res = await originalFetch(`${NETLIFY_API}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ record: slim }),
    });
    if (!res.ok) throw new Error(`netlify-share-${res.status}`);
    const data = await res.json().catch(() => ({}));
    const key = String(data.key || "").replace(/^n:/, "");
    if (!key) throw new Error("netlify-share-empty");
    return `n:${key}`;
  }

  async function publishBytebinShare(slim) {
    const res = await originalFetch(`${BYTEBIN}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(slim),
    });
    if (!res.ok) throw new Error(`bytebin-${res.status}`);
    const data = await res.json().catch(() => ({}));
    const key = data.key || String(res.headers.get("location") || "").replace(/^\/+/, "");
    if (!key) throw new Error("bytebin-empty");
    return `b:${key}`;
  }

  async function publishShareBlob(record, shareKey) {
    const slim = slimShareRecord(record, shareKey);
    let ref = "";
    try {
      ref = await publishNetlifyShare(slim);
    } catch {
      ref = await publishBytebinShare(slim);
    }
    setCachedShareRef(record.id, shareKey, ref, slim.revision);
    return ref;
  }

  async function fetchShareBlob(token) {
    const parsed = parseSharePayloadToken(token.startsWith("b:") || token.startsWith("n:") ? token : `b:${token}`);
    if (parsed.kind === "netlify") {
      const res = await originalFetch(`${NETLIFY_API}/api/share/${encodeURIComponent(parsed.value)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`netlify-share-get-${res.status}`);
      return res.json();
    }
    const res = await originalFetch(`${BYTEBIN}/${encodeURIComponent(parsed.value)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`bytebin-get-${res.status}`);
    return res.json();
  }

  function parseSharePayloadToken(payload) {
    const raw = String(payload || "");
    if (raw.startsWith("n:")) return { kind: "netlify", value: raw.slice(2) };
    if (raw.startsWith("b:")) return { kind: "bin", value: raw.slice(2) };
    if (raw.startsWith("i:")) return { kind: "inline", value: raw.slice(2) };
    // Legacy bare base64 payload
    if (raw.length > 20) return { kind: "inline", value: raw };
    return { kind: "unknown", value: raw };
  }

  function seedSharePayloadFromHash() {
    try {
      const hash = String(location.hash || "").replace(/^#/, "");
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const id = params.get("trip");
      const key = params.get("key");
      const payload = params.get("s") || params.get("payload");
      if (!id || !payload) return;
      const parsed = parseSharePayloadToken(payload);
      if (parsed.kind !== "inline") return; // bin needs async hydrate
      const json = decodeInlineSharePayload(parsed.value);
      applySeededRecord(id, key, json);
    } catch {
      /* ignore bad payload */
    }
  }

  let hydrateInFlight = null;
  async function hydrateTripFromShare(tripIdHint) {
    seedSharePayloadFromHash();
    const hash = String(location.hash || "").replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const id = params.get("trip") || tripIdHint || "";
    const key = params.get("key") || "";
    const payload = params.get("s") || params.get("payload") || "";
    if (!id || !payload) return;
    if (tripIdHint && id !== tripIdHint) return;

    const existing = readLocalTrips()[id];
    const parsed = parseSharePayloadToken(payload);

    const applyIncoming = (json) => {
      const incomingRev = Number(json?.revision) || 1;
      const localRev = Number(existing?.revision) || 0;
      // Refresh when missing locally or snapshot is newer.
      if (!existing?.trip || incomingRev >= localRev) {
        applySeededRecord(id, key, json);
      }
    };

    if (parsed.kind === "inline") {
      try {
        applyIncoming(decodeInlineSharePayload(parsed.value));
      } catch {
        /* ignore */
      }
      return;
    }
    if ((parsed.kind !== "bin" && parsed.kind !== "netlify") || !parsed.value) return;
    // Already have same-or-newer local copy: skip network.
    if (existing?.trip && !params.get("force")) {
      /* still allow fetch for first open on another device — existing empty above */
    }

    if (hydrateInFlight) {
      try {
        await hydrateInFlight;
      } catch {
        /* ignore */
      }
      return;
    }
    hydrateInFlight = (async () => {
      const prefix = parsed.kind === "netlify" ? "n:" : "b:";
      const json = await fetchShareBlob(prefix + parsed.value);
      applyIncoming(json);
    })();
    try {
      await hydrateInFlight;
    } finally {
      hydrateInFlight = null;
    }
  }

  async function resolveShareRef(tripId, shareKey) {
    const rec = readLocalTrips()[tripId];
    if (!rec?.trip) return "";
    const cached = getCachedShareRef(tripId, shareKey);
    if (cached) return cached;
    try {
      return await publishShareBlob(rec, shareKey);
    } catch {
      // Fallback: inline snapshot for small trips / offline publish failure.
      const inline = encodeInlineSharePayload(rec, shareKey);
      if (inline && inline.length <= 3500) {
        setCachedShareRef(tripId, shareKey, inline, rec.revision || 1);
        return inline;
      }
      return "";
    }
  }

  window.__pvIsTripLocalOnly = function isTripLocalOnly(tripId) {
    const id =
      tripId ||
      new URLSearchParams(String(location.hash || "").replace(/^#/, "")).get("trip") ||
      "";
    if (!id) return false;
    return Boolean(readLocalTrips()[id]?.local);
  };
  window.__pvHasShareSnapshot = function hasShareSnapshot(tripId, shareKey) {
    return Boolean(getCachedShareRef(tripId, shareKey));
  };

  seedSharePayloadFromHash();
  window.addEventListener("hashchange", () => {
    seedSharePayloadFromHash();
    void hydrateTripFromShare();
  });
  void hydrateTripFromShare();

  /** Keep address-bar / copied share links self-contained via short blob refs. */
  async function ensureHashSharePayload() {
    try {
      const hash = String(location.hash || "").replace(/^#/, "");
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const tripId = params.get("trip");
      const key = params.get("key");
      if (!tripId || !key) return;
      const rec = readLocalTrips()[tripId];
      if (!rec?.trip) return;
      const ref = await resolveShareRef(tripId, key);
      if (!ref) return;
      if (params.get("s") === ref) return;
      params.set("s", ref);
      // Drop legacy long inline payloads from the live hash when we have a short ref.
      const next = `#${params.toString()}`;
      if (next !== location.hash) {
        history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
      }
    } catch {
      /* ignore */
    }
  }

  setTimeout(() => {
    void ensureHashSharePayload();
  }, 0);
  setInterval(() => {
    void ensureHashSharePayload();
  }, 5000);

  // Sync helper used by the React share-link builder (patched Ye).
  window.__pvGetShareRef = function getShareRef(tripId, shareKey) {
    return getCachedShareRef(tripId, shareKey) || "";
  };
  window.__pvEncodeTripShare = function encodeTripShare(tripId, shareKey) {
    return getCachedShareRef(tripId, shareKey) || "";
  };
  window.__pvPrepareShare = async function prepareShare(tripId, shareKey) {
    return resolveShareRef(tripId, shareKey);
  };

  /** Enrich copied share links with a durable short snapshot ref. */
  function enrichShareUrl(text) {
    try {
      const raw = String(text || "").trim();
      if (!raw || raw.length > 20000) return text;
      let url;
      try {
        url = new URL(raw);
      } catch {
        return text;
      }
      if (!url.hash || url.hash.indexOf("trip=") < 0) return text;
      const params = new URLSearchParams(url.hash.replace(/^#/, ""));
      const tripId = params.get("trip");
      const key = params.get("key");
      if (!tripId || !key) return text;
      const ref = getCachedShareRef(tripId, key);
      if (!ref) {
        // Kick off publish for next copy; still try inline if small.
        void resolveShareRef(tripId, key);
        const rec = readLocalTrips()[tripId];
        if (!rec?.trip) return text;
        const inline = encodeInlineSharePayload(rec, key);
        if (!inline || inline.length > 3500) return text;
        params.set("s", inline);
      } else {
        params.set("s", ref);
      }
      url.hash = params.toString();
      return url.toString();
    } catch {
      return text;
    }
  }

  function shareUrlHasSnapshot(text) {
    try {
      const url = new URL(String(text || ""));
      const params = new URLSearchParams(url.hash.replace(/^#/, ""));
      const s = params.get("s") || "";
      return /^[nbi]:/.test(s) || s.length > 20;
    } catch {
      return false;
    }
  }

  function notifyShareBlocked(message) {
    try {
      window.dispatchEvent(new CustomEvent("pv-share-blocked", { detail: { message } }));
    } catch {
      /* ignore */
    }
    try {
      console.warn("[pronti-via]", message);
    } catch {
      /* ignore */
    }
  }

  const originalWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
  if (originalWriteText) {
    navigator.clipboard.writeText = async (text) => {
      const raw = String(text || "");
      if (raw.includes("trip=") && raw.includes("key=")) {
        try {
          const url = new URL(raw);
          const params = new URLSearchParams(url.hash.replace(/^#/, ""));
          const tripId = params.get("trip");
          const key = params.get("key");
          if (tripId && key) {
            const ref = await resolveShareRef(tripId, key);
            if (!ref) {
              const msg =
                "Link non pronto: lo snapshot di condivisione non è riuscito. Riprova tra qualche secondo.";
              notifyShareBlocked(msg);
              throw new Error(msg);
            }
          }
        } catch (err) {
          if (err && /snapshot|Link non pronto/i.test(String(err.message || ""))) throw err;
        }
        const enriched = enrichShareUrl(raw);
        if (!shareUrlHasSnapshot(enriched)) {
          const msg =
            "Link incompleto: manca lo snapshot (s=). Non condividerlo finché non è pronto.";
          notifyShareBlocked(msg);
          throw new Error(msg);
        }
        return originalWriteText(enriched);
      }
      return originalWriteText(text);
    };
  }

  // If the UI uses navigator.share, enrich the URL the same way.
  if (typeof navigator.share === "function") {
    const originalShare = navigator.share.bind(navigator);
    navigator.share = async (data = {}) => {
      const next = { ...data };
      try {
        const url = new URL(String(next.url || location.href));
        const params = new URLSearchParams(url.hash.replace(/^#/, ""));
        const tripId = params.get("trip");
        const key = params.get("key");
        if (tripId && key) {
          const ref = await resolveShareRef(tripId, key);
          if (!ref) {
            const msg =
              "Condivisione non pronta: impossibile creare lo snapshot. Riprova tra poco.";
            notifyShareBlocked(msg);
            throw new Error(msg);
          }
          next.url = enrichShareUrl(next.url || url.toString());
          if (!shareUrlHasSnapshot(next.url)) {
            const msg = "Link incompleto senza snapshot. Condivisione annullata.";
            notifyShareBlocked(msg);
            throw new Error(msg);
          }
        } else if (typeof next.url === "string") {
          next.url = enrichShareUrl(next.url);
        }
      } catch (err) {
        if (err && /snapshot|Condivisione|Link incompleto/i.test(String(err.message || ""))) {
          throw err;
        }
      }
      return originalShare(next);
    };
  }

  function readLocalFilesDb() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_FILES_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeLocalFilesDb(db) {
    try {
      localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(db));
      return true;
    } catch {
      return false;
    }
  }

  function fileMetaList(tripId) {
    const rows = readLocalFilesDb()[tripId] || [];
    return rows.map(({ id, name, size, type, at }) => ({
      id,
      name,
      size: Number(size) || 0,
      type: type || "application/octet-stream",
      at: at || null,
    }));
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read"));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToResponse(dataUrl, name, type) {
    const m = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) return jsonResponse(404, { error: "File non trovato" });
    const mime = m[1] || type || "application/octet-stream";
    const isB64 = Boolean(m[2]);
    const payload = m[3] || "";
    let bytes;
    if (isB64) {
      const bin = atob(payload);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      bytes = arr;
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${String(name || "file").replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  async function handleLocalTripFiles(tripId, fileId, method, init, record, canEdit, canView) {
    if (!canView) return jsonResponse(403, { error: "Link non valido" });
    const db = readLocalFilesDb();
    const rows = Array.isArray(db[tripId]) ? db[tripId] : [];

    if (method === "GET" && !fileId) {
      return jsonResponse(200, { files: fileMetaList(tripId) });
    }

    if (method === "GET" && fileId) {
      const row = rows.find((f) => f.id === fileId);
      if (!row?.dataUrl) return jsonResponse(404, { error: "File non trovato" });
      return dataUrlToResponse(row.dataUrl, row.name, row.type);
    }

    if (method === "POST" && !fileId) {
      if (!canEdit) return jsonResponse(403, { error: "Link non valido" });
      if (rows.length >= MAX_TRIP_FILES) {
        return jsonResponse(400, { error: `Massimo ${MAX_TRIP_FILES} file per viaggio.` });
      }
      try {
        const form = init.body;
        let file = null;
        if (form && typeof FormData !== "undefined" && form instanceof FormData) {
          file = form.get("file");
        } else if (form && typeof form.arrayBuffer === "function") {
          // Already a Blob/File
          file = form;
        }
        if (!file || typeof file.arrayBuffer !== "function") {
          return jsonResponse(400, { error: "Nessun file ricevuto." });
        }
        if (file.size > MAX_FILE_BYTES) {
          return jsonResponse(400, { error: "Il file supera 10 MB" });
        }
        const dataUrl = await blobToDataUrl(file);
        const entry = {
          id: crypto.randomUUID(),
          name: String(file.name || "allegato").slice(0, 180),
          size: Number(file.size) || 0,
          type: String(file.type || "application/octet-stream"),
          at: new Date().toISOString(),
          dataUrl,
        };
        const next = rows.concat(entry);
        db[tripId] = next;
        if (!writeLocalFilesDb(db)) {
          return jsonResponse(507, {
            error: "Spazio insufficiente su questo dispositivo. Elimina allegati o usa un file più piccolo.",
          });
        }
        return jsonResponse(200, {
          ok: true,
          file: { id: entry.id, name: entry.name, size: entry.size, type: entry.type, at: entry.at },
          files: fileMetaList(tripId),
          local: true,
        });
      } catch (err) {
        return jsonResponse(400, {
          error: err instanceof Error ? err.message : "Caricamento non riuscito",
        });
      }
    }

    if (method === "DELETE" && fileId) {
      if (!canEdit) return jsonResponse(403, { error: "Link non valido" });
      db[tripId] = rows.filter((f) => f.id !== fileId);
      writeLocalFilesDb(db);
      return jsonResponse(200, { ok: true, id: fileId, deleted: true, local: true });
    }

    return jsonResponse(405, { error: "Metodo non supportato" });
  }

  async function handleLocalTrips(pathname, search, init = {}) {
    const method = (init.method || "GET").toUpperCase();
    const parts = pathname.replace(/^\/api\/trips\/?/, "").split("/").filter(Boolean);
    const id = parts[0] ? decodeURIComponent(parts[0]) : "";
    const sub = parts[1] ? decodeURIComponent(parts[1]) : "";
    const fileId = parts[2] ? decodeURIComponent(parts[2]) : "";
    const key = bearerKey(init);
    const db = readLocalTrips();

    if (method === "POST" && !id) {
      let body;
      try {
        body = typeof init.body === "string" ? JSON.parse(init.body) : init.body || {};
      } catch {
        return jsonResponse(400, { error: "Dati viaggio non validi." });
      }
      const newId = crypto.randomUUID();
      const editKey = randomHex(32);
      const viewToken = randomHex(32);
      if (
        typeof rewriteTripWriteInit._pendingBudget === "number" &&
        rewriteTripWriteInit._pendingBudget > 0
      ) {
        setPrivateBudget(newId, rewriteTripWriteInit._pendingBudget);
        rewriteTripWriteInit._pendingBudget = null;
      } else if (typeof body.budget === "number" && body.budget > 0) {
        setPrivateBudget(newId, body.budget);
      }
      const tripBody =
        body?.trip && typeof body.trip === "object" && !Array.isArray(body.trip)
          ? body.trip
          : body;
      const sharedTrip = { ...tripBody, budget: 0 };
      const record = {
        id: newId,
        key: editKey,
        viewToken,
        trip: sharedTrip,
        revision: 1,
        canEdit: true,
        updated: new Date().toISOString(),
        local: true,
      };
      db[newId] = record;
      writeLocalTrips(db);
      void resolveShareRef(newId, editKey);
      void resolveShareRef(newId, viewToken);
      return jsonResponse(200, {
        id: newId,
        key: editKey,
        viewToken,
        trip: applyPrivateBudgetView(newId, sharedTrip),
        revision: 1,
        canEdit: true,
        updated: record.updated,
        local: true,
      });
    }

    if (!id) return jsonResponse(404, { error: "Viaggio non trovato" });
    const record = db[id];
    if (!record) return jsonResponse(404, { error: "Viaggio non trovato" });

    const canEdit = Boolean(
      key &&
        (key === record.key ||
          // Legacy local records without a stored edit key: only the creator device.
          (!record.key && record.local && !record.viewToken))
    );
    const canView =
      canEdit ||
      !record.key ||
      key === record.viewToken ||
      key === record.key ||
      // Allow open from recent-links / share payload when viewToken matches or local seed present
      Boolean(record.local && key && (key === record.viewToken || !record.viewToken));

    // /api/trips/:id/files[/:fileId] — never fall through to trip JSON (React Documenti crashes).
    if (sub === "files") {
      return handleLocalTripFiles(id, fileId, method, init, record, canEdit, canView);
    }

    if (method === "GET") {
      if (!canView) return jsonResponse(403, { error: "Link non valido" });
      return jsonResponse(200, {
        trip: applyPrivateBudgetView(id, record.trip),
        revision: record.revision || 1,
        updated: record.updated,
        canEdit,
        viewToken: record.viewToken || "",
        local: Boolean(record.local),
      });
    }

    if (method === "PUT" || method === "PATCH") {
      if (!canEdit) return jsonResponse(403, { error: "Link non valido" });
      let body;
      try {
        body = typeof init.body === "string" ? JSON.parse(init.body) : init.body || {};
      } catch {
        return jsonResponse(400, { error: "Dati viaggio non validi." });
      }
      const nextTrip = takeBudgetPrivate(id, body.trip || body);
      const serverRev = Number(record.revision) || 1;
      const clientRev = Number(body.revision);
      if (Number.isFinite(clientRev) && clientRev !== serverRev) {
        return jsonResponse(409, {
          error: "Versione non aggiornata. Ricarica e riprova.",
          trip: applyPrivateBudgetView(id, record.trip),
          revision: serverRev,
          updated: record.updated,
          canEdit: true,
          viewToken: record.viewToken || "",
          local: true,
        });
      }
      record.trip = nextTrip;
      record.revision = serverRev + 1;
      record.updated = new Date().toISOString();
      db[id] = record;
      writeLocalTrips(db);
      void resolveShareRef(id, record.key);
      if (record.viewToken) void resolveShareRef(id, record.viewToken);
      return jsonResponse(200, {
        trip: applyPrivateBudgetView(id, record.trip),
        revision: record.revision,
        updated: record.updated,
        canEdit: true,
        viewToken: record.viewToken || "",
        local: true,
      });
    }

    if (method === "DELETE") {
      if (!canEdit) return jsonResponse(403, { error: "Solo chi ha la chiave di modifica può eliminare il viaggio." });
      purgeLocalTrip(id);
      return jsonResponse(200, { ok: true, id, deleted: true, local: true });
    }

    return jsonResponse(405, { error: "Metodo non supportato" });
  }

  function cleanPlaceName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function placeNamesEqual(a, b) {
    return cleanPlaceName(a).toLocaleLowerCase("it") === cleanPlaceName(b).toLocaleLowerCase("it");
  }

  function bilingualPlaceTitle(local, translation) {
    const loc = cleanPlaceName(local);
    const tr = cleanPlaceName(translation);
    if (loc && tr && !placeNamesEqual(loc, tr)) return `${tr} (${loc})`;
    return tr || loc;
  }

  function nominatimNameBundle(item) {
    const nd = item.namedetails || {};
    const local = cleanPlaceName(nd.name || item.name || item.display_name?.split(",")[0] || "");
    const italian = cleanPlaceName(nd["name:it"] || nd["official_name:it"] || nd["alt_name:it"] || "");
    const english = cleanPlaceName(nd["name:en"] || nd["official_name:en"] || "");
    const preferred = cleanPlaceName(item.name || "");
    let translation = italian;
    let translationLang = italian ? "it" : "";
    if (
      !translation &&
      preferred &&
      !placeNamesEqual(preferred, local) &&
      !/[^\u0000-\u024F\u1E00-\u1EFF\s.,'’\-()/]/.test(preferred)
    ) {
      translation = preferred;
      translationLang = "it";
    }
    if (!translation && english && !placeNamesEqual(english, local)) {
      translation = english;
      translationLang = "en";
    }
    return { local, italian, english, translation, translationLang };
  }

  function placeFromNominatim(item, scope) {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    const names = nominatimNameBundle(item);
    const primary = bilingualPlaceTitle(names.local, names.translation || names.local);
    const address = item.address || {};
    const country = cleanPlaceName(address.country);
    const region = cleanPlaceName(address.state || address.region);
    let title = primary;
    if (scope === "destination" && country && primary && !placeNamesEqual(country, primary)) {
      title =
        region && !placeNamesEqual(region, primary) && !placeNamesEqual(region, country)
          ? `${primary}, ${region}, ${country}`
          : `${primary}, ${country}`;
    } else if (scope !== "destination") {
      title =
        [primary, cleanPlaceName(address.city || address.town || address.village), country]
          .filter(Boolean)
          .filter((part, idx, arr) => arr.findIndex((x) => placeNamesEqual(x, part)) === idx)
          .join(", ") || item.display_name;
    }
    const subtitleBits = [];
    if (names.translation && names.local && !placeNamesEqual(names.translation, names.local)) {
      subtitleBits.push(
        names.translationLang === "en"
          ? `in inglese: ${names.translation}`
          : `in italiano: ${names.translation}`
      );
    }
    if (item.display_name) subtitleBits.push(item.display_name);
    return {
      id: `osm-${item.place_id}`,
      title,
      name: names.translation || names.local || title,
      nameLocal: names.local || "",
      nameIt: names.italian || "",
      nameEn: names.english || "",
      translation: names.translation || "",
      translationLang: names.translationLang || "",
      subtitle: subtitleBits.join(" · "),
      address: item.display_name,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      type: item.type || item.class || "place",
      mapsUrl:
        Number.isFinite(lat) && Number.isFinite(lng)
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`,
      osmUrl:
        Number.isFinite(lat) && Number.isFinite(lng)
          ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
          : `https://www.openstreetmap.org/search?query=${encodeURIComponent(title)}`,
    };
  }

  async function searchNominatimPlaces(q, scope) {
    const params = new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      namedetails: "1",
      limit: scope === "destination" ? "10" : "8",
      "accept-language": "it",
    });
    const rows = await originalFetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "it",
      },
      signal: AbortSignal.timeout(12000),
    }).then((r) => {
      if (!r.ok) throw new Error(`nominatim-${r.status}`);
      return r.json();
    });
    return (Array.isArray(rows) ? rows : []).map((item) => placeFromNominatim(item, scope));
  }

  async function searchPlaces(query, scope) {
    const q = String(query || "").trim();
    if (q.length < 2) return { places: [] };

    // Prefer Nominatim (namedetails → Italian + local). Photon lang=it is often empty.
    let places = [];
    try {
      places = await searchNominatimPlaces(q, scope);
    } catch {
      places = [];
    }

    if (!places.length) {
      const photonParams = new URLSearchParams({ q, limit: "10", lang: "default" });
      let features = [];
      try {
        const data = await originalFetch(`https://photon.komoot.io/api/?${photonParams}`).then((r) =>
          r.json()
        );
        features = Array.isArray(data.features) ? data.features : [];
      } catch {
        features = [];
      }

      places = features.map((feature) => {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        const name = props.name || props.city || props.country || "Luogo";
        const type = props.type || props.osm_value || "place";
        let title = name;
        if (props.country && name !== props.country) {
          title =
            props.state && props.state !== name
              ? `${name}, ${props.state}, ${props.country}`
              : `${name}, ${props.country}`;
        }
        const address = [props.name, props.city, props.state, props.country]
          .filter(Boolean)
          .join(", ");
        return {
          id: `photon-${props.osm_id || `${lat},${lng}`}`,
          title,
          name,
          nameLocal: name,
          nameIt: "",
          nameEn: "",
          translation: "",
          translationLang: "",
          subtitle: address,
          address,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          type,
          mapsUrl:
            Number.isFinite(lat) && Number.isFinite(lng)
              ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`,
          osmUrl:
            Number.isFinite(lat) && Number.isFinite(lng)
              ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
              : `https://www.openstreetmap.org/search?query=${encodeURIComponent(title)}`,
        };
      });
    }

    const destinationTypes = new Set([
      "country",
      "state",
      "city",
      "town",
      "village",
      "locality",
      "region",
      "county",
      "administrative",
      "island",
      "municipality",
    ]);
    const filtered =
      scope === "destination"
        ? places.filter((p) => destinationTypes.has(String(p.type || "").toLowerCase()))
        : places;

    return { places: (filtered.length ? filtered : places).slice(0, 8) };
  }

  async function fetchTripsCandidate(target, init, timeoutMs = PER_TRY_MS) {
    const ctrl = new AbortController();
    const externalAbort = () => ctrl.abort();
    if (init.signal) {
      if (init.signal.aborted) throw new DOMException("Aborted", "AbortError");
      init.signal.addEventListener("abort", externalAbort, { once: true });
    }
    try {
      const res = await Promise.race([
        originalFetch(target, { ...init, signal: ctrl.signal }),
        wallTimeout(timeoutMs, "proxy-timeout"),
      ]);
      if (res.type === "opaque" || res.status === 0) throw new Error("opaque");
      // Accept 2xx/4xx JSON from the CORS proxy; only hard-fail transport/5xx/HTML.
      if (res.status >= 500) throw new Error(`upstream-${res.status}`);
      const ct = String(res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) throw new Error("html-error");
      if (!ct.includes("json") && res.status !== 204) {
        const peek = await res.clone().text();
        const trimmed = peek.trim();
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) throw new Error("not-json");
      }
      return res;
    } finally {
      if (init.signal) init.signal.removeEventListener("abort", externalAbort);
    }
  }

  async function remoteTrips(suffix, init) {
    // Prefer Netlify CORS proxy (required from GitHub Pages). Direct Supabase has no ACAO.
    const proxyTargets = TRIPS_PROXIES.map((base) => `${base}/api${suffix}`);
    const isSearch = String(suffix || "").startsWith("/search");
    const candidates = isSearch
      ? [`${NETLIFY_API}/api${suffix}`]
      : onGitHubPages
        ? [`${NETLIFY_API}/api${suffix}`, ...proxyTargets]
        : [`${NETLIFY_API}/api${suffix}`, `${TRIPS_BASE}${suffix}`, ...proxyTargets];
    const timeoutMs = isSearch ? 55000 : PER_TRY_MS;

    // Try sequentially so a CORS-blocked candidate does not race-win as rejection noise.
    let lastErr;
    for (const target of candidates) {
      try {
        return await fetchTripsCandidate(target, init, timeoutMs);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("no-remote");
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    let parsed;
    try {
      parsed = new URL(url, location.origin);
    } catch {
      return originalFetch(input, init);
    }

    if (parsed.origin === location.origin && parsed.pathname === "/api/places") {
      // Prefer the Netlify places function (Nominatim namedetails + Italian labels).
      if (sameOriginApiProxy) {
        try {
          const res = await Promise.race([
            originalFetch(input, init),
            wallTimeout(15000, "places-timeout"),
          ]);
          if (res && res.ok) return res;
        } catch {
          /* fall through to client fallback */
        }
      } else {
        try {
          const res = await remoteTrips(`/places${parsed.search}`, { ...init, method: "GET" });
          if (res && res.ok) return res;
        } catch {
          /* fall through to client fallback */
        }
      }
      try {
        const data = await searchPlaces(
          parsed.searchParams.get("q"),
          parsed.searchParams.get("scope")
        );
        return jsonResponse(200, data);
      } catch {
        return jsonResponse(502, { error: "Ricerca mappe non disponibile." });
      }
    }

    if (parsed.origin === location.origin && parsed.pathname === "/api/pois") {
      const suffix = `/pois${parsed.search}`;
      try {
        if (sameOriginApiProxy) {
          return Promise.race([
            originalFetch(input, init),
            wallTimeout(28000, "pois-timeout"),
          ]);
        }
        return await remoteTrips(suffix, { ...init, method: "GET" });
      } catch {
        return jsonResponse(502, { error: "Ricerca luoghi non disponibile." });
      }
    }

    if (parsed.origin === location.origin && parsed.pathname.startsWith("/api/account")) {
      const suffix = `${parsed.pathname.replace(/^\/api/, "")}${parsed.search}`;
      try {
        return await remoteTrips(suffix, init);
      } catch {
        return jsonResponse(503, { error: "Sync account non disponibile. Controlla la rete e riprova." });
      }
    }

    if (
      parsed.origin === location.origin &&
      parsed.pathname.startsWith("/api/trips")
    ) {
      const methodEarly = (init.method || "GET").toUpperCase();
      const runTripRequest = async () => {

      const suffix = `${parsed.pathname.replace(/^\/api/, "")}${parsed.search}`;
      const method = (init.method || "GET").toUpperCase();
      const tripIdHint = decodeURIComponent(
        parsed.pathname.replace(/^\/api\/trips\/?/, "").split("/").filter(Boolean)[0] || ""
      );
      const writeInit = await rewriteTripWriteInit(parsed.pathname, init);

      // Before opening a shared trip, hydrate snapshot from hash (inline or bytebin).
      if (method === "GET" && tripIdHint) {
        try {
          await hydrateTripFromShare(tripIdHint);
        } catch {
          /* continue with remote/local */
        }
      }

      // Prefer same-origin reverse proxy when available (Netlify / local).
      if (sameOriginApiProxy) {
        try {
          const res = await Promise.race([
            originalFetch(input, writeInit),
            wallTimeout(PER_TRY_MS, "local-proxy-timeout"),
          ]);
          if (res.ok) {
            try {
              const data = await res.clone().json();
              const id = data.id || tripIdHint;
              if (method === "GET" && id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: data.canEdit,
                  key: bearerKey(writeInit),
                  updated: data.updated,
                  source: data.source,
                  durable: data.durable,
                  local: isEphemeralPersistence(data) ? true : Boolean(data.local),
                });
              }
              if (method === "POST" && data?.id && data?.trip) {
                cacheTripRecord(data.id, {
                  ...data,
                  local: isEphemeralPersistence(data) ? true : Boolean(data.local),
                });
                trackTripWriteResult(method, data.id, writeInit, data);
              }
              if ((method === "PUT" || method === "PATCH") && id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: true,
                  key: bearerKey(writeInit),
                  updated: data.updated,
                  source: data.source,
                  durable: data.durable,
                  local: isEphemeralPersistence(data) ? true : Boolean(data.local),
                });
                trackTripWriteResult(method, id, writeInit, data);
              }
              if (method === "DELETE" && (data?.deleted || data?.ok)) {
                purgeLocalTrip(id || tripIdHint);
              }
            } catch {
              /* ignore cache errors */
            }
            return withPrivateBudgetResponse(res, tripIdHint);
          }
          // Static hosts (GitHub Pages / python -m http.server) return 404 HTML for /api/*.
          // Fall through to remote cloud API instead of forcing local-only trips.
          const ct = String(res.headers.get("content-type") || "").toLowerCase();
          const looksMissing =
            res.status === 404 ||
            res.status === 405 ||
            ct.includes("text/html");
          if (!looksMissing && res.status < 500) {
            return withPrivateBudgetResponse(res, tripIdHint);
          }
        } catch {
          /* use remote/local fallback */
        }
      }

      try {
        const res = await remoteTrips(suffix, writeInit);
        const filesPath = /\/files(?:\/|$)/.test(parsed.pathname);
        if (res.ok) {
          try {
            const data = await res.clone().json();
            // Documenti UI requires `files` array; never pass trip JSON through.
            const filesParts = parsed.pathname.replace(/^\/api\/trips\/?/, "").split("/").filter(Boolean);
            if (filesPath && method === "GET" && !filesParts[2] && !Array.isArray(data?.files)) {
              return handleLocalTrips(parsed.pathname, parsed.search, writeInit);
            }
            if (method === "POST" && data?.id) {
              cacheTripRecord(data.id, {
                ...data,
                local: isEphemeralPersistence(data) ? true : Boolean(data.local),
              });
              trackTripWriteResult(method, data.id, writeInit, data);
            }
            if (method === "GET" && !filesPath) {
              const id = data.id || tripIdHint;
              if (id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: data.canEdit,
                  key: bearerKey(writeInit),
                  updated: data.updated,
                  source: data.source,
                  durable: data.durable,
                  local: isEphemeralPersistence(data) ? true : Boolean(data.local),
                });
              }
            }
            if ((method === "PUT" || method === "PATCH") && data?.trip) {
              const id = tripIdHint || data.id;
              if (id) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: true,
                  key: bearerKey(writeInit),
                  updated: data.updated,
                  source: data.source,
                  durable: data.durable,
                  local: isEphemeralPersistence(data) ? true : Boolean(data.local),
                });
                trackTripWriteResult(method, id, writeInit, data);
              }
            }
            if (method === "DELETE" && (data?.deleted || data?.ok || res.status === 200)) {
              purgeLocalTrip(tripIdHint || data.id);
            }
          } catch {
            /* ignore */
          }
        }
        // Cloud 404/403 for GET → try local copy before surfacing error.
        if (!res.ok && method === "GET") {
          const local = await handleLocalTrips(parsed.pathname, parsed.search, writeInit);
          if (local.status === 200) return local;
        }
        // DELETE: if cloud says missing/unsupported, still purge local copy when we hold the key.
        if (!res.ok && method === "DELETE") {
          const local = await handleLocalTrips(parsed.pathname, parsed.search, writeInit);
          if (local.status === 200) return local;
          // 404 on cloud still means "gone" — clear local leftovers.
          if (res.status === 404 || res.status === 405) {
            purgeLocalTrip(tripIdHint);
            return jsonResponse(200, { ok: true, id: tripIdHint, deleted: true, local: true });
          }
        }
        // POST must not silently become local-only when cloud returns 4xx —
        // that creates unshareable trips. Only fall back on transport failure.
        return withPrivateBudgetResponse(res, tripIdHint);
      } catch {
        // All remote proxies failed — durable local fallback.
        const localRes = await handleLocalTrips(parsed.pathname, parsed.search, writeInit);
        try {
          if (
            method === "PUT" ||
            method === "PATCH" ||
            method === "POST"
          ) {
            const data = await localRes.clone().json();
            trackTripWriteResult(method, data.id || tripIdHint, writeInit, {
              ...data,
              local: true,
              source: data.source || "local",
            });
          }
        } catch {
          /* ignore */
        }
        return localRes;
      }
    
      };
      if (
        methodEarly === "PUT" ||
        methodEarly === "PATCH" ||
        methodEarly === "POST" ||
        methodEarly === "DELETE"
      ) {
        return enqueueTripWrite(runTripRequest);
      }
      return runTripRequest();
    }

    // Free invite-code shares: local durable map when Netlify share is unreachable.
    if (parsed.origin === location.origin && parsed.pathname.startsWith("/api/share")) {
      const method = String(init.method || "GET").toUpperCase();
      const INVITE_SHARES_KEY = "viavia-invite-shares-v1";
      const readInviteShares = () => {
        try {
          return JSON.parse(localStorage.getItem(INVITE_SHARES_KEY) || "{}") || {};
        } catch {
          return {};
        }
      };
      const writeInviteShares = (db) => {
        localStorage.setItem(INVITE_SHARES_KEY, JSON.stringify(db));
      };
      const shareId = decodeURIComponent(
        parsed.pathname.replace(/^\/api\/share\/?/, "").split("/")[0] || ""
      );
      let remoteRes = null;
      try {
        remoteRes = await remoteTrips(`/share${shareId ? `/${shareId}` : ""}${parsed.search}`, init);
        if (remoteRes.ok) return remoteRes;
      } catch {
        remoteRes = null;
      }
      if (method === "POST") {
        let body = {};
        try {
          body = JSON.parse(String(init.body || "{}"));
        } catch {
          body = {};
        }
        const record = body.record || body;
        const inviteRaw = String(body.inviteCode || record.code || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        const inviteOk =
          /^[A-Z0-9]{6}$/.test(inviteRaw) &&
          record &&
          typeof record === "object" &&
          (record.kind === "invite" || body.inviteCode);
        if (!inviteOk) {
          return (
            remoteRes ||
            jsonResponse(503, { error: "Servizio condivisione non disponibile." })
          );
        }
        const id = `inv-${inviteRaw}`;
        const db = readInviteShares();
        db[id] = {
          ...record,
          kind: "invite",
          code: inviteRaw,
          publishedAt: new Date().toISOString(),
        };
        writeInviteShares(db);
        return jsonResponse(201, { key: id, ref: `n:${id}` });
      }
      if (method === "GET" && shareId) {
        const hit = readInviteShares()[shareId.replace(/^n:/, "")];
        if (hit) return jsonResponse(200, hit);
        return remoteRes || jsonResponse(404, { error: "Snapshot non trovato o scaduto." });
      }
      if (remoteRes) return remoteRes;
    }

    if (
      parsed.origin === location.origin &&
      parsed.pathname.startsWith("/api/") &&
      !parsed.pathname.startsWith("/api/places") &&
      !parsed.pathname.startsWith("/api/account")
    ) {
      const suffix = `${parsed.pathname.replace(/^\/api/, "")}${parsed.search}`;
      try {
        return await remoteTrips(suffix, init);
      } catch {
        return jsonResponse(503, {
          error: "Connessione non riuscita. Controlla la rete e riprova.",
        });
      }
    }

    return originalFetch(input, init);
  };
})();
