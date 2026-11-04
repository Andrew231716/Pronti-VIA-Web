import { corsHeadersFor } from "../../lib/cors.mjs";

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
  "locality",
]);

let activeCors = corsHeadersFor(null, {
  methods: "GET, OPTIONS",
  headers: "Content-Type",
});

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      ...activeCors,
    },
    body: JSON.stringify(body),
  };
}

function cleanName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesEqual(a, b) {
  return cleanName(a).toLocaleLowerCase("it") === cleanName(b).toLocaleLowerCase("it");
}

function hasNonLatinScript(value) {
  // Anything outside basic Latin / Latin-1 / Latin Extended blocks.
  return /[^\u0000-\u024F\u1E00-\u1EFF\u2C60-\u2C7F\uA720-\uA7FF\s.,'’\-()/]/.test(
    String(value || "")
  );
}

function extractNameBundle(item) {
  const nd = item.namedetails || {};
  const local = cleanName(nd.name || item.name || item.display_name?.split(",")[0] || "");
  const it = cleanName(nd["name:it"] || nd["official_name:it"] || nd["alt_name:it"] || "");
  const en = cleanName(nd["name:en"] || nd["official_name:en"] || nd["alt_name:en"] || "");
  const preferred = cleanName(item.name || "");

  let italian = it;
  // When Nominatim localized the primary label to Italian (accept-language=it)
  // but namedetails lacks name:it, reuse that preferred label if it differs from local.
  if (!italian && preferred && !namesEqual(preferred, local) && !hasNonLatinScript(preferred)) {
    italian = preferred;
  }

  let translation = italian;
  let translationLang = italian ? "it" : "";
  if (!translation && en && !namesEqual(en, local)) {
    translation = en;
    translationLang = "en";
  }

  return { local, italian, english: en, translation, translationLang };
}

function bilingualPrimary(local, translation) {
  const loc = cleanName(local);
  const tr = cleanName(translation);
  if (loc && tr && !namesEqual(loc, tr)) return `${tr} (${loc})`;
  return tr || loc;
}

function regionBits(address = {}) {
  return {
    country: cleanName(address.country),
    region: cleanName(address.state || address.region || address.state_district),
  };
}

function destinationTitle(item, names) {
  const address = item.address || {};
  const { country, region } = regionBits(address);
  const primary = bilingualPrimary(names.local, names.translation || names.local);
  if (item.type === "country" || address.country === names.local || address.country === primary) {
    return primary || item.display_name;
  }
  if (country && primary && !namesEqual(country, primary) && !namesEqual(country, names.local)) {
    return region && region !== primary && region !== country && !namesEqual(region, names.local)
      ? `${primary}, ${region}, ${country}`
      : `${primary}, ${country}`;
  }
  return primary || item.display_name;
}

function buildGenericLabel(item, names) {
  const address = item.address || {};
  const primary = bilingualPrimary(names.local, names.translation || names.local);
  const parts = [
    primary,
    cleanName(address.city || address.town || address.village || address.state),
    cleanName(address.country),
  ].filter(Boolean);
  return (
    [...new Set(parts.map((part) => cleanName(part)).filter(Boolean))].join(", ") ||
    item.display_name
  );
}

function buildSubtitle(item, names, title) {
  const bits = [];
  if (names.translation && names.local && !namesEqual(names.translation, names.local)) {
    if (names.translationLang === "it") bits.push(`in italiano: ${names.translation}`);
    else if (names.translationLang === "en") bits.push(`in inglese: ${names.translation}`);
  }
  const display = cleanName(item.display_name || "");
  // Keep a compact location hint without repeating the bilingual title.
  const locationHint = display
    .split(",")
    .map((part) => cleanName(part))
    .filter(Boolean)
    .filter((part) => !namesEqual(part, names.local) && !namesEqual(part, names.translation))
    .slice(0, 3)
    .join(", ");
  if (locationHint && !namesEqual(locationHint, title)) bits.push(locationHint);
  return bits.join(" · ") || display || title;
}

function toPlaceFromNominatim(item, scope) {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const names = extractNameBundle(item);
  const title = scope === "destination" ? destinationTitle(item, names) : buildGenericLabel(item, names);
  const name = names.translation || names.local || title;
  return {
    id: `osm-${item.place_id}`,
    title,
    name,
    nameLocal: names.local || "",
    nameIt: names.italian || "",
    nameEn: names.english || "",
    translation: names.translation || "",
    translationLang: names.translationLang || "",
    subtitle: buildSubtitle(item, names, title),
    address: item.display_name,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    type: item.type || item.class || "place",
    importance: Number(item.importance) || 0,
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

function toPlaceFromPhoton(feature, scope, langTag = "") {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  const type = props.type || props.osm_value || "place";
  const name = cleanName(props.name || props.city || props.country || "Luogo");
  let title;
  if (scope === "destination") {
    if (type === "country" || props.country === name) title = name;
    else if (props.country && name && props.country !== name) {
      title =
        props.state && props.state !== name
          ? `${name}, ${props.state}, ${props.country}`
          : `${name}, ${props.country}`;
    } else title = name;
  } else {
    title =
      [...new Set([props.name, props.city || props.county, props.state, props.country].filter(Boolean))]
        .map(cleanName)
        .filter(Boolean)
        .join(", ") || name;
  }
  const address = [props.name, props.city, props.state, props.country].filter(Boolean).join(", ");
  return {
    id: `photon-${props.osm_id || `${lat},${lng}`}`,
    title,
    name,
    nameLocal: langTag === "default" ? name : "",
    nameIt: langTag === "it" ? name : "",
    nameEn: langTag === "en" ? name : "",
    translation: langTag === "it" || langTag === "en" ? name : "",
    translationLang: langTag === "it" || langTag === "en" ? langTag : "",
    subtitle: address,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    type,
    importance: 0.2,
    osmId: props.osm_id || null,
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

function mergePhotonPair(localPlace, itPlace, scope) {
  const localName = cleanName(localPlace?.nameLocal || localPlace?.name || "");
  const itName = cleanName(itPlace?.nameIt || itPlace?.name || "");
  const base = itPlace || localPlace;
  if (!base) return null;
  const translation = itName && localName && !namesEqual(itName, localName) ? itName : itName || "";
  const primary = bilingualPrimary(localName || itName, translation || itName);
  const country = cleanName(base.address?.split?.(",")?.slice(-1)?.[0] || "");
  let title = primary;
  if (scope === "destination" && country && primary && !namesEqual(country, primary)) {
    title = `${primary}, ${country}`;
  } else if (scope !== "destination") {
    title = base.title;
    if (localName && translation && !namesEqual(localName, translation)) {
      title = bilingualPrimary(localName, translation);
    }
  }
  const subtitleBits = [];
  if (localName && translation && !namesEqual(localName, translation)) {
    subtitleBits.push(`in italiano: ${translation}`);
    subtitleBits.push(localName);
  }
  if (base.subtitle) subtitleBits.push(base.subtitle);
  return {
    ...base,
    title,
    name: translation || localName || base.name,
    nameLocal: localName || base.nameLocal || "",
    nameIt: translation || base.nameIt || "",
    translation: translation || "",
    translationLang: translation ? "it" : "",
    subtitle: [...new Set(subtitleBits.filter(Boolean))].join(" · ") || base.subtitle,
  };
}

function isDestinationPlace(place) {
  const type = String(place.type || "").toLowerCase();
  if (DESTINATION_TYPES.has(type)) return true;
  return ["country", "city", "town", "village", "state", "locality", "administrative"].some((token) =>
    type.includes(token)
  );
}

function destinationRank(place) {
  const type = String(place.type || "").toLowerCase();
  if (type === "country") return 0;
  if (type === "state" || type === "region") return 1;
  if (type === "city" || type === "town" || type === "administrative") return 2;
  if (type === "village" || type === "municipality" || type === "locality") return 3;
  return 4;
}

function queryMatchScore(place, q) {
  const query = q.toLowerCase();
  const candidates = [place.name, place.title, place.nameLocal, place.nameIt, place.nameEn, place.translation]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);
  if (candidates.some((value) => value === query)) return 0;
  if (candidates.some((value) => value.startsWith(query))) return 1;
  if (candidates.some((value) => value.includes(query))) return 2;
  return 3;
}

function dedupePlaces(places, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const place of places) {
    const key = [
      cleanName(place.nameLocal).toLowerCase(),
      cleanName(place.nameIt || place.translation).toLowerCase(),
      cleanName(place.title).toLowerCase(),
    ]
      .filter(Boolean)
      .join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Also collapse near-duplicates on title alone.
    const titleKey = cleanName(place.title).toLowerCase();
    if (seen.has(`t:${titleKey}`)) continue;
    seen.add(`t:${titleKey}`);
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
    namedetails: "1",
    limit: scope === "destination" ? "12" : "8",
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
  return (Array.isArray(rows) ? rows : []).map((item) => toPlaceFromNominatim(item, scope));
}

async function searchNominatimCountry(q) {
  const params = new URLSearchParams({
    q,
    format: "json",
    addressdetails: "1",
    namedetails: "1",
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
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const place = toPlaceFromNominatim(item, "destination");
    place.importance = Math.max(place.importance || 0, 0.9);
    return place;
  });
}

async function fetchPhoton(q, lang) {
  const params = new URLSearchParams({ q, limit: "10", lang });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.features) ? data.features : [];
}

async function searchPhoton(q, scope) {
  const settled = await Promise.allSettled([fetchPhoton(q, "it"), fetchPhoton(q, "default")]);
  const itFeatures = settled[0].status === "fulfilled" ? settled[0].value : [];
  const localFeatures = settled[1].status === "fulfilled" ? settled[1].value : [];
  if (!itFeatures.length && !localFeatures.length) {
    if (settled.every((result) => result.status === "rejected")) {
      throw settled[0].reason || new Error("Photon unavailable");
    }
    return [];
  }

  const byOsm = new Map();
  for (const feature of localFeatures) {
    const place = toPlaceFromPhoton(feature, scope, "default");
    const key = place.osmId || place.id;
    byOsm.set(key, { local: place, it: null });
  }
  for (const feature of itFeatures) {
    const place = toPlaceFromPhoton(feature, scope, "it");
    const key = place.osmId || place.id;
    const row = byOsm.get(key) || { local: null, it: null };
    row.it = place;
    byOsm.set(key, row);
  }

  return [...byOsm.values()]
    .map(({ local, it }) => mergePhotonPair(local, it, scope))
    .filter(Boolean)
    .filter((place) => (scope === "destination" ? isDestinationPlace(place) : true));
}

export async function handler(event) {
  activeCors = corsHeadersFor(event, {
    methods: "GET, OPTIONS",
    headers: "Content-Type",
  });
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: activeCors,
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
    let places = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

    if (scope === "destination") {
      places = places
        .filter(isDestinationPlace)
        .sort(
          (a, b) =>
            queryMatchScore(a, q) - queryMatchScore(b, q) ||
            destinationRank(a) - destinationRank(b) ||
            (b.importance || 0) - (a.importance || 0) ||
            a.title.localeCompare(b.title, "it")
        );
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
