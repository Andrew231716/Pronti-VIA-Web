/**
 * Client fallback when /api/* is not reverse-proxied (e.g. GitHub Pages).
 * Places → Photon; trips → CORS proxies, then durable localStorage fallback.
 * v=20260917f — local trips so the app works even when cloud proxies die.
 */
(() => {
  const TRIPS_BASE =
    "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";
  const TRIPS_PROXIES = [
    "https://bonds-wheel-cambridge-theme.trycloudflare.com",
    "https://temporary-turbo-juniper-d9oc7zv.vercel.app",
    "https://temporary-sonic-dune-wq1xaoq.vercel.app",
  ];
  const NETLIFY_API = "https://pronti-via-k7es.netlify.app";
  const LOCAL_TRIPS_KEY = "viavia-local-trips-v1";
  const PER_TRY_MS = 4000;

  const originalFetch = window.fetch.bind(window);
  const onGitHubPages = /\.github\.io$/i.test(location.hostname);
  const sameOriginApiProxy =
    /\.trycloudflare\.com$/i.test(location.hostname) ||
    /\.vercel\.app$/i.test(location.hostname) ||
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
    db[id] = {
      id,
      key: record.key || db[id]?.key || "",
      viewToken: record.viewToken || db[id]?.viewToken || "",
      trip: record.trip,
      revision: record.revision || 1,
      canEdit: record.canEdit !== false,
      updated: record.updated || new Date().toISOString(),
      local: Boolean(record.local || db[id]?.local),
    };
    writeLocalTrips(db);
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
      const record = {
        id: newId,
        key: editKey,
        viewToken,
        trip: body,
        revision: 1,
        canEdit: true,
        updated: new Date().toISOString(),
        local: true,
      };
      db[newId] = record;
      writeLocalTrips(db);
      return jsonResponse(200, {
        id: newId,
        key: editKey,
        viewToken,
        trip: body,
        revision: 1,
        canEdit: true,
        updated: record.updated,
        local: true,
      });
    }

    if (!id) return jsonResponse(404, { error: "Viaggio non trovato" });
    const record = db[id];
    if (!record) return jsonResponse(404, { error: "Viaggio non trovato" });

    const canEdit = Boolean(key && (key === record.key || (!record.key && record.local)));
    const canView =
      canEdit ||
      !record.key ||
      key === record.viewToken ||
      key === record.key ||
      // Allow open from recent-links even if cloud key was stored for a local trip
      Boolean(record.local && key);

    if (method === "GET") {
      if (!canView) return jsonResponse(403, { error: "Link non valido" });
      return jsonResponse(200, {
        trip: record.trip,
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
      const nextTrip = body.trip || body;
      const revision = Number(body.revision || record.revision || 1) + 1;
      record.trip = nextTrip;
      record.revision = revision;
      record.updated = new Date().toISOString();
      db[id] = record;
      writeLocalTrips(db);
      return jsonResponse(200, {
        trip: record.trip,
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
    const proxyTargets = TRIPS_PROXIES.map((base) => `${base}/api${suffix}`);
    const candidates = onGitHubPages
      ? [...proxyTargets, `${NETLIFY_API}/api${suffix}`, `${TRIPS_BASE}${suffix}`]
      : [`${TRIPS_BASE}${suffix}`, `${NETLIFY_API}/api${suffix}`, ...proxyTargets];
    return Promise.any(candidates.map((target) => fetchTripsCandidate(target, init)));
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

    if (parsed.origin === location.origin && parsed.pathname.startsWith("/api/account")) {
      return jsonResponse(503, { error: "Sync cloud non disponibile su questo host." });
    }

    if (
      parsed.origin === location.origin &&
      parsed.pathname.startsWith("/api/trips")
    ) {
      const suffix = `${parsed.pathname.replace(/^\/api/, "")}${parsed.search}`;
      const method = (init.method || "GET").toUpperCase();

      // Prefer same-origin reverse proxy when available.
      if (sameOriginApiProxy) {
        try {
          const res = await Promise.race([
            originalFetch(input, init),
            wallTimeout(PER_TRY_MS, "local-proxy-timeout"),
          ]);
          if (res.ok) {
            try {
              const data = await res.clone().json();
              const id = parsed.pathname.split("/").pop();
              if (method === "GET" && id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: data.canEdit,
                  key: bearerKey(init),
                  updated: data.updated,
                });
              }
              if (method === "POST" && data?.id && data?.trip) {
                cacheTripRecord(data.id, data);
              }
            } catch {
              /* ignore cache errors */
            }
          }
          // If upstream hard-failed, fall through to local for resilience.
          if (res.ok || res.status < 500) return res;
        } catch {
          /* use remote/local fallback */
        }
      }

      try {
        const res = await remoteTrips(suffix, init);
        if (res.ok) {
          try {
            const data = await res.clone().json();
            if (method === "POST" && data?.id) cacheTripRecord(data.id, data);
            if (method === "GET") {
              const id = decodeURIComponent(parsed.pathname.split("/").pop() || "");
              if (id && data?.trip) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: data.canEdit,
                  key: bearerKey(init),
                  updated: data.updated,
                });
              }
            }
            if ((method === "PUT" || method === "PATCH") && data?.trip) {
              const id = decodeURIComponent(parsed.pathname.split("/").pop() || "");
              if (id) {
                cacheTripRecord(id, {
                  trip: data.trip,
                  revision: data.revision,
                  viewToken: data.viewToken,
                  canEdit: true,
                  key: bearerKey(init),
                  updated: data.updated,
                });
              }
            }
          } catch {
            /* ignore */
          }
        }
        // Cloud 404/403 for GET → try local copy before surfacing error.
        if (!res.ok && method === "GET") {
          const local = await handleLocalTrips(parsed.pathname, parsed.search, init);
          if (local.status === 200) return local;
        }
        return res;
      } catch {
        // All remote proxies failed — durable local fallback.
        return handleLocalTrips(parsed.pathname, parsed.search, init);
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
