/**
 * Client fallback when /api/places is not available (e.g. static hosts).
 * Account stays on localStorage via account.js.
 */
(() => {
  const TRIPS_BASE =
    "https://cvdlzwralgtapsigyuko.supabase.co/functions/v1/pronti-via";

  const originalFetch = window.fetch.bind(window);

  async function searchPlaces(query, scope) {
    const q = String(query || "").trim();
    if (q.length < 2) return { places: [] };

    const photonParams = new URLSearchParams({ q, limit: "10", lang: "default" });
    const photonPromise = originalFetch(`https://photon.komoot.io/api/?${photonParams}`).then((r) =>
      r.json()
    );

    let features = [];
    try {
      const data = await photonPromise;
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
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Ricerca mappe non disponibile." }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (parsed.origin === location.origin && parsed.pathname.startsWith("/api/account")) {
      // Let account.js local flow handle auth; return soft failure for cloud sync.
      return new Response(JSON.stringify({ error: "Sync cloud non disponibile su questo host." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If host has no reverse-proxy for trips, try direct Supabase (may fail on CORS).
    if (
      parsed.origin === location.origin &&
      parsed.pathname.startsWith("/api/") &&
      !parsed.pathname.startsWith("/api/places") &&
      !parsed.pathname.startsWith("/api/account")
    ) {
      const target = `${TRIPS_BASE}${parsed.pathname.replace(/^\/api/, "")}${parsed.search}`;
      try {
        const proxied = await originalFetch(target, init);
        if (proxied.type !== "opaque" && proxied.status !== 0) return proxied;
      } catch {
        /* fall through */
      }
    }

    return originalFetch(input, init);
  };
})();
