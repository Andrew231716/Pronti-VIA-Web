const USER_AGENT = "ProntiVIAWeb/1.0 (https://pronti-via-k7es.netlify.app; travel planner)";

const DESTINATION_TYPES = new Set([
  "country",
  "state",
  "region",
  "province",
  "city",
  "town",
  "village",
  "municipality",
  "county",
  "administrative",
  "island",
  "archipelago",
]);

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function destinationTitle(item) {
  const address = item.address || {};
  const name =
    item.name ||
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.state ||
    address.region ||
    address.country ||
    item.display_name?.split(",")[0];
  const country = address.country;
  const region = address.state || address.region;
  if (item.type === "country" || address.country === name) return name || item.display_name;
  if (country && name && country !== name) {
    return region && region !== name && region !== country
      ? `${name}, ${region}, ${country}`
      : `${name}, ${country}`;
  }
  return name || item.display_name;
}

function toPlaceFromNominatim(item, scope) {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const title = scope === "destination" ? destinationTitle(item) : buildGenericLabel(item);
  return {
    id: `osm-${item.place_id}`,
    title,
    subtitle: item.display_name,
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

function buildGenericLabel(item) {
  const address = item.address || {};
  const parts = [
    item.name ||
      address.tourism ||
      address.amenity ||
      address.historic ||
      address.attraction ||
      address.city ||
      address.town ||
      address.village ||
      address.municipality,
    address.city || address.town || address.village || address.state,
    address.country,
  ].filter(Boolean);
  return [...new Set(parts.map((part) => String(part).trim()).filter(Boolean))].join(", ") ||
    item.display_name;
}

function toPlaceFromPhoton(feature, scope) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  const type = props.type || props.osm_value || "place";
  let title;
  if (scope === "destination") {
    const name = props.name || props.city || props.country;
    if (type === "country" || props.country === name) title = name;
    else if (props.country && name && props.country !== name) {
      title = props.state && props.state !== name
        ? `${name}, ${props.state}, ${props.country}`
        : `${name}, ${props.country}`;
    } else title = name || "Luogo";
  } else {
    title = [...new Set([props.name, props.city || props.county, props.state, props.country].filter(Boolean))].join(", ") ||
      props.name ||
      "Luogo";
  }
  const address = [props.name, props.city, props.state, props.country].filter(Boolean).join(", ");
  return {
    id: `photon-${props.osm_id || `${lat},${lng}`}`,
    title,
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
}

function isDestinationPlace(place) {
  const type = String(place.type || "").toLowerCase();
  if (DESTINATION_TYPES.has(type)) return true;
  // Photon sometimes uses osm_key/value equivalents already flattened into type.
  return ["country", "city", "town", "village", "state", "locality"].some((token) =>
    type.includes(token)
  );
}

function destinationRank(place) {
  const type = String(place.type || "").toLowerCase();
  if (type === "country") return 0;
  if (type === "state" || type === "region") return 1;
  if (type === "city" || type === "town") return 2;
  if (type === "village" || type === "municipality") return 3;
  return 4;
}

function dedupePlaces(places, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const place of places) {
    const key = place.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
    if (out.length >= limit) break;
  }
  return out;
}

async function searchNominatim(q, scope) {
  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    limit: scope === "destination" ? "12" : "8",
    "accept-language": "it",
  });
  if (scope === "destination") {
    // Prefer admin areas / settlements.
    params.set("featureType", "settlement");
  }
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "it",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((item) => toPlaceFromNominatim(item, scope));
}

async function searchNominatimCountry(q) {
  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    limit: "5",
    featureType: "country",
    "accept-language": "it",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "it",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Nominatim country ${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((item) => toPlaceFromNominatim(item, "destination"));
}

async function searchPhoton(q, scope) {
  const params = new URLSearchParams({ q, limit: "10", lang: "en" });
  if (scope === "destination") {
    params.set("osm_tag", ":!highway");
    params.append("layer", "country");
    params.append("layer", "state");
    params.append("layer", "city");
    params.append("layer", "locality");
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data.features) ? data.features : []).map((feature) =>
    toPlaceFromPhoton(feature, scope)
  );
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Usa GET." });
  }

  const q = String(event.queryStringParameters?.q || "").trim();
  const scope = String(event.queryStringParameters?.scope || "").trim();
  if (q.length < 2) {
    return json(400, { error: "Scrivi almeno 2 caratteri." });
  }

  try {
    const searches =
      scope === "destination"
        ? [searchNominatim(q, scope), searchNominatimCountry(q), searchPhoton(q, scope)]
        : [searchNominatim(q, scope), searchPhoton(q, scope)];

    const settled = await Promise.allSettled(searches);
    let places = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    if (scope === "destination") {
      places = places
        .filter(isDestinationPlace)
        .sort((a, b) => destinationRank(a) - destinationRank(b) || a.title.localeCompare(b.title, "it"));
    }

    places = dedupePlaces(places, 8);

    if (!places.length && settled.every((result) => result.status === "rejected")) {
      return json(502, {
        error: "Ricerca mappe non disponibile al momento. Riprova tra poco.",
      });
    }
    return json(200, { places });
  } catch (error) {
    console.error(error);
    return json(502, {
      error: "Ricerca mappe non disponibile al momento. Riprova tra poco.",
    });
  }
}
