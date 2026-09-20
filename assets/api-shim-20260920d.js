/**
 * Client fallback when /api/* is not reverse-proxied (e.g. GitHub Pages).
 * Places → Photon; trips → CORS-enabled Netlify proxy, then durable localStorage.
 * v=20260920c — short share links via bytebin so WhatsApp/iOS keep the trip snapshot.
 */
(() => {
  const TRIPS_BASE =
    "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";
  // Dead CF tunnels removed — they only slowed Promise.any and forced local fallback.
  const TRIPS_PROXIES = [];
  const NETLIFY_API = "https://pronti-via-k7es.netlify.app";
  const LOCAL_TRIPS_KEY = "viavia-local-trips-v1";
  const PRIVATE_BUDGET_KEY = "viavia-private-budget-v1";
  const SHARE_BLOBS_KEY = "viavia-share-blobs-v1";
  const BYTEBIN = "https://bytebin.lucko.me";
  const PER_TRY_MS = 8000;

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

  function cacheTripRecord(id, record) {
    if (!id || !record?.trip) return;
    const db = readLocalTrips();
    // Never persist private budget into the shared/local trip blob.
    const sharedTrip = { ...record.trip, budget: 0 };
    db[id] = {
      id,
      key: record.key || db[id]?.key || "",
      viewToken: record.viewToken || db[id]?.viewToken || "",
      trip: sharedTrip,
      revision: record.revision || 1,
      canEdit: record.canEdit !== false,
      updated: record.updated || new Date().toISOString(),
      local: Boolean(record.local || db[id]?.local),
    };
    writeLocalTrips(db);
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

  async function publishShareBlob(record, shareKey) {
    const slim = slimShareRecord(record, shareKey);
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
    const ref = `b:${key}`;
    setCachedShareRef(record.id, shareKey, ref, slim.revision);
    return ref;
  }

  async function fetchShareBlob(binKey) {
    const res = await originalFetch(`${BYTEBIN}/${encodeURIComponent(binKey)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`bytebin-get-${res.status}`);
    return res.json();
  }

  function parseSharePayloadToken(payload) {
    const raw = String(payload || "");
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
    if (readLocalTrips()[id]?.trip) return;

    const parsed = parseSharePayloadToken(payload);
    if (parsed.kind === "inline") {
      try {
        applySeededRecord(id, key, decodeInlineSharePayload(parsed.value));
      } catch {
        /* ignore */
      }
      return;
    }
    if (parsed.kind !== "bin" || !parsed.value) return;

    if (hydrateInFlight) {
      try {
        await hydrateInFlight;
      } catch {
        /* ignore */
      }
      return;
    }
    hydrateInFlight = (async () => {
      const json = await fetchShareBlob(parsed.value);
      applySeededRecord(id, key, json);
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

  const originalWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
  if (originalWriteText) {
    navigator.clipboard.writeText = async (text) => {
      try {
        const raw = String(text || "");
        if (raw.includes("trip=") && raw.includes("key=")) {
          const url = new URL(raw);
          const params = new URLSearchParams(url.hash.replace(/^#/, ""));
          const tripId = params.get("trip");
          const key = params.get("key");
          if (tripId && key) await resolveShareRef(tripId, key);
        }
      } catch {
        /* ignore */
      }
      return originalWriteText(enrichShareUrl(text));
    };
  }

  // If the UI uses navigator.share, enrich the URL the same way.
  if (typeof navigator.share === "function") {
    const originalShare = navigator.share.bind(navigator);
    navigator.share = async (data = {}) => {
      const next = { ...data };
      if (typeof next.url === "string") next.url = enrichShareUrl(next.url);
      try {
        const url = new URL(String(next.url || location.href));
        const params = new URLSearchParams(url.hash.replace(/^#/, ""));
        const tripId = params.get("trip");
        const key = params.get("key");
        if (tripId && key) {
          await resolveShareRef(tripId, key);
          next.url = enrichShareUrl(next.url || url.toString());
        }
      } catch {
        /* ignore */
      }
      return originalShare(next);
    };
  }

  async function handleLocalTrips(pathname, search, init = {}) {
    const method = (init.method || "GET").toUpperCase();
    const parts = pathname.replace(/^\/api\/trips\/?/, "").split("/").filter(Boolean);
    const id = parts[0] ? decodeURIComponent(parts[0]) : "";
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
      const revision = Number(body.revision || record.revision || 1) + 1;
      record.trip = nextTrip;
      record.revision = revision;
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

    return jsonResponse(405, { error: "Metodo non supportato" });
  }

  async function searchPlaces(query, scope) {
    const q = String(query || "").trim();
    if (q.length < 2) return { places: [] };

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

    const places = features.map((feature) => {
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

    const destinationTypes = new Set([
      "country",
      "state",
      "city",
      "town",
      "village",
      "locality",
      "region",
      "county",
    ]);
    const filtered =
      scope === "destination"
        ? places.filter((p) => destinationTypes.has(String(p.type || "").toLowerCase()))
        : places;

    return { places: (filtered.length ? filtered : places).slice(0, 8) };
  }

  async function fetchTripsCandidate(target, init) {
    const ctrl = new AbortController();
    const externalAbort = () => ctrl.abort();
    if (init.signal) {
      if (init.signal.aborted) throw new DOMException("Aborted", "AbortError");
      init.signal.addEventListener("abort", externalAbort, { once: true });
    }
    try {
      const res = await Promise.race([
        originalFetch(target, { ...init, signal: ctrl.signal }),
        wallTimeout(PER_TRY_MS, "proxy-timeout"),
      ]);
      if (res.type === "opaque" || res.status === 0) throw new Error("opaque");
      // Accept 2xx/4xx JSON from the CORS proxy; only hard-fail transport/5xx/HTML.
      if (res.status >= 500) throw new Error(`upstream-${res.status}`);
      const ct = String(res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) throw new Error("html-error");
      if (!ct.includes("json")) {
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
    const candidates = onGitHubPages
      ? [`${NETLIFY_API}/api${suffix}`, ...proxyTargets]
      : [`${NETLIFY_API}/api${suffix}`, `${TRIPS_BASE}${suffix}`, ...proxyTargets];

    // Try sequentially so a CORS-blocked candidate does not race-win as rejection noise.
    let lastErr;
    for (const target of candidates) {
      try {
        return await fetchTripsCandidate(target, init);
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
      return jsonResponse(503, { error: "Sync cloud non disponibile su questo host." });
    }

    if (
      parsed.origin === location.origin &&
      parsed.pathname.startsWith("/api/trips")
    ) {
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
                  local: false,
                });
              }
              if (method === "POST" && data?.id && data?.trip) {
                cacheTripRecord(data.id, { ...data, local: false });
              }
              if ((method === "PUT" || method === "PATCH") && id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: true,
                  key: bearerKey(writeInit),
                  updated: data.updated,
                  local: false,
                });
              }
            } catch {
              /* ignore cache errors */
            }
            return withPrivateBudgetResponse(res, tripIdHint);
          }
          // Proxy miss / validation: prefer durable local copy when present.
          if (method === "GET" || method === "POST" || res.status >= 500) {
            try {
              const local = await handleLocalTrips(parsed.pathname, parsed.search, writeInit);
              if (local.status === 200 || method === "POST") return local;
            } catch {
              /* continue */
            }
          }
          if (res.status < 500) return withPrivateBudgetResponse(res, tripIdHint);
        } catch {
          /* use remote/local fallback */
        }
      }

      try {
        const res = await remoteTrips(suffix, writeInit);
        if (res.ok) {
          try {
            const data = await res.clone().json();
            if (method === "POST" && data?.id) cacheTripRecord(data.id, { ...data, local: false });
            if (method === "GET") {
              const id = data.id || tripIdHint;
              if (id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: data.canEdit,
                  key: bearerKey(writeInit),
                  updated: data.updated,
                  local: false,
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
                  local: false,
                });
              }
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
        // POST must not silently become local-only when cloud returns 4xx —
        // that creates unshareable trips. Only fall back on transport failure.
        return withPrivateBudgetResponse(res, tripIdHint);
      } catch {
        // All remote proxies failed — durable local fallback.
        return handleLocalTrips(parsed.pathname, parsed.search, writeInit);
      }
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
