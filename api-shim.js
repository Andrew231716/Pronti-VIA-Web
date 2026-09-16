/**
 * Client fallback when /api/* is not reverse-proxied (e.g. GitHub Pages).
 * Places → Photon; trips → Supabase direct, then Netlify CORS proxy.
 */
(() => {
  const TRIPS_BASE =
    "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";
  // Temporary CORS proxy while Netlify production redeploy is unavailable.
  const TRIPS_PROXY = "https://purchases-variation-sophisticated-adrian.trycloudflare.com";
  const NETLIFY_API = "https://pronti-via-k7es.netlify.app";

  const originalFetch = window.fetch.bind(window);
  const onGitHubPages = /\.github\.io$/i.test(location.hostname);

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
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Ricerca mappe non disponibile." }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (parsed.origin === location.origin && parsed.pathname.startsWith("/api/account")) {
      return new Response(JSON.stringify({ error: "Sync cloud non disponibile su questo host." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      parsed.origin === location.origin &&
      parsed.pathname.startsWith("/api/") &&
      !parsed.pathname.startsWith("/api/places") &&
      !parsed.pathname.startsWith("/api/account")
    ) {
      const suffix = `${parsed.pathname.replace(/^\/api/, "")}${parsed.search}`;
      const candidates = onGitHubPages
        ? [`${TRIPS_PROXY}/api${suffix}`, `${NETLIFY_API}/api${suffix}`, `${TRIPS_BASE}${suffix}`]
        : [`${TRIPS_BASE}${suffix}`, `${NETLIFY_API}/api${suffix}`, `${TRIPS_PROXY}/api${suffix}`];

      for (const target of candidates) {
        try {
          const proxied = await originalFetch(target, init);
          if (proxied.type !== "opaque" && proxied.status !== 0) return proxied;
        } catch {
          /* try next */
        }
      }
    }

    return originalFetch(input, init);
  };
})();
