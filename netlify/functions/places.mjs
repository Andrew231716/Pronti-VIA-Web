const USER_AGENT = "ProntiVIAWeb/1.0 (https://pronti-via-k7es.netlify.app; travel planner)";

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

function buildLabel(item) {
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
  const unique = [...new Set(parts.map((part) => String(part).trim()).filter(Boolean))];
  return unique.join(", ") || item.display_name;
}

function toPlaceFromNominatim(item) {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const title = buildLabel(item);
  return {
    id: `osm-${item.place_id}`,
    title,
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

function toPlaceFromPhoton(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  const parts = [props.name, props.city || props.county, props.state, props.country].filter(Boolean);
  const title = [...new Set(parts)].join(", ") || props.name || "Luogo";
  const address = props.extent
    ? title
    : [props.name, props.street, props.city, props.state, props.country].filter(Boolean).join(", ");
  return {
    id: `photon-${props.osm_id || `${lat},${lng}`}`,
    title,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    type: props.type || props.osm_value || "place",
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

function dedupePlaces(places) {
  const seen = new Set();
  const out = [];
  for (const place of places) {
    const key =
      place.lat != null && place.lng != null
        ? `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`
        : place.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
    if (out.length >= 8) break;
  }
  return out;
}

async function searchNominatim(q) {
  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    limit: "8",
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
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map(toPlaceFromNominatim);
}

async function searchPhoton(q) {
  const params = new URLSearchParams({ q, limit: "8", lang: "en" });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data.features) ? data.features : []).map(toPlaceFromPhoton);
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
  if (q.length < 2) {
    return json(400, { error: "Scrivi almeno 2 caratteri." });
  }

  try {
    const settled = await Promise.allSettled([searchNominatim(q), searchPhoton(q)]);
    const places = dedupePlaces(
      settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    );
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
