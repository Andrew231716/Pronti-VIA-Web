/**
 * Live flight + stay search for Preventivo intelligente.
 * Flights → OctoTrip MCP (real aggregator offers)
 * Stays → LockTrip MCP (live hotel/apartment availability)
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function actionOf(event, body) {
  const q = event.queryStringParameters || {};
  return String(q.action || body.action || "").toLowerCase();
}

async function fetchText(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  return { res, text };
}

/** OctoTrip returns SSE: event/data lines with JSON-RPC payload. */
function parseOctoTripSse(raw) {
  const dataLines = String(raw || "")
    .split(/\n/)
    .filter((l) => l.startsWith("data: "))
    .map((l) => l.slice(6).trim())
    .filter(Boolean);
  if (!dataLines.length) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Risposta voli non leggibile.");
    }
  }
  const rpc = JSON.parse(dataLines[dataLines.length - 1]);
  if (rpc.error) {
    throw new Error(rpc.error.message || "Ricerca voli non riuscita.");
  }
  const text = rpc.result?.content?.[0]?.text;
  if (!text) throw new Error("Nessun risultato voli.");
  return JSON.parse(text);
}

function normalizeFlight(offer, adults) {
  const price = Number(offer.price) || 0;
  const pp = adults > 0 ? price / adults : price;
  const out = offer.outbound || {};
  const ret = offer.return || {};
  return {
    id: `live-${offer.airline_code || "xx"}-${out.departure || ""}-${out.arrival || ""}-${out.departure_time || ""}-${price}`,
    airline: offer.airline || "",
    airlineCode: offer.airline_code || "",
    from: out.departure || "",
    to: out.arrival || "",
    depart: out.departure_date || "",
    returnDate: ret.departure_date || "",
    departTime: out.departure_time || "",
    returnTime: ret.departure_time || "",
    stops: Number.isFinite(offer.stops) ? offer.stops : offer.is_direct ? 0 : 1,
    isDirect: Boolean(offer.is_direct),
    durationMinutes: offer.total_duration_minutes || null,
    bags: offer.baggage || "Da verificare",
    perPersonCents: Math.round(pp * 100),
    totalGroupCents: Math.round(price * 100),
    currency: offer.currency || "EUR",
    status: "STIMA",
    groupFareConfirmed: false,
    source: offer.gate ? `Live · ${offer.gate}` : "Live · OctoTrip",
    url: offer.booking_url || "",
    flightNumbers: offer.flight_numbers || [],
    notes: "Prezzo live da aggregatore — verifica disponibilità gruppo e bagagli sul sito di prenotazione.",
    live: true,
  };
}

async function searchFlightsOnce({
  origin,
  destination,
  departure_date,
  return_date,
  adults,
  currency,
}) {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search",
      arguments: {
        origin,
        destination,
        departure_date,
        return_date,
        adults,
        currency,
        locale: "it",
      },
    },
  };

  const { res, text } = await fetchText("https://mcp.octotrip.app/flights/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = new Error(`Aggregatore voli non disponibile (${res.status}).`);
    err.detail = text.slice(0, 300);
    throw err;
  }
  return parseOctoTripSse(text);
}

async function searchFlights(body) {
  const originsRaw = Array.isArray(body.origins)
    ? body.origins
    : String(body.origin || body.from || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const origins = [...new Set(originsRaw.map((s) => String(s).trim()).filter(Boolean))].slice(
    0,
    3
  );
  const destination = String(body.destination || body.to || "").trim();
  const departure_date = String(body.departure_date || body.start || "").trim();
  const return_date = String(body.return_date || body.end || "").trim() || null;
  const adults = Math.min(9, Math.max(1, Number(body.adults) || 1));
  const currency = String(body.currency || "EUR").toUpperCase();
  const maxStops =
    body.maxStops === "" || body.maxStops == null ? null : Number(body.maxStops);

  if (!origins.length || !destination || !departure_date) {
    return json(400, {
      error: "Per i voli servono partenza, destinazione e data di andata.",
    });
  }

  const batches = await Promise.allSettled(
    origins.map((origin) =>
      searchFlightsOnce({
        origin,
        destination,
        departure_date,
        return_date,
        adults,
        currency,
      })
    )
  );

  let offers = [];
  const errors = [];
  for (const batch of batches) {
    if (batch.status === "fulfilled") {
      const results = Array.isArray(batch.value?.results) ? batch.value.results : [];
      offers.push(...results);
    } else {
      errors.push(batch.reason?.message || "errore");
    }
  }

  if (!offers.length) {
    return json(502, {
      error: errors[0] || "Nessun volo trovato per queste date/rotta.",
      errors,
    });
  }

  if (Number.isFinite(maxStops)) {
    offers = offers.filter((o) => Number(o.stops ?? (o.is_direct ? 0 : 99)) <= maxStops);
  }

  // Dedupe by airline+route+times+price
  const seen = new Set();
  const unique = [];
  for (const o of offers) {
    const key = [
      o.airline_code,
      o.outbound?.departure,
      o.outbound?.arrival,
      o.outbound?.departure_time,
      o.return?.departure_time,
      o.price,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(o);
  }
  unique.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

  const flights = unique.slice(0, 15).map((o) => normalizeFlight(o, adults));
  return json(200, {
    ok: true,
    kind: "flights",
    query: {
      origins,
      destination,
      departure_date,
      return_date,
      adults,
      currency,
    },
    count: flights.length,
    flights,
    warnings: errors.length ? errors : undefined,
    fetchedAt: new Date().toISOString(),
    disclaimer:
      "Prezzi live da aggregatore. Validità breve; conferma sempre su compagnia/sito di prenotazione, specie per gruppi.",
  });
}

async function locktripPost(tool, body) {
  const { res, text } = await fetchText(`https://locktrip.com/mcp/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Risposta alloggi non valida (${tool}).`);
  }
  if (!res.ok || data?.error) {
    const msg = data?.error?.message || `Alloggi non disponibili (${tool}).`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function looksLikeHostel(hotel) {
  const blob = `${hotel.name || ""} ${(hotel.amenities || []).join(" ")}`.toLowerCase();
  return /hostel|ostello|dormitor|backpacker|capsule/.test(blob);
}

function normalizeStay(hotel, nights, adults) {
  const total = Number(hotel.minPrice) || 0;
  const nightly = nights > 0 ? total / nights : total;
  return {
    id: `stay-${hotel.hotelId || hotel.id || uidFallback()}`,
    hotelId: String(hotel.hotelId || hotel.id || ""),
    title: hotel.name || "Alloggio",
    starRating: hotel.starRating ?? null,
    address: hotel.address || "",
    lat: hotel.latitude ?? null,
    lng: hotel.longitude ?? null,
    image: Array.isArray(hotel.images) ? hotel.images[0] : "",
    amenities: Array.isArray(hotel.amenities) ? hotel.amenities.slice(0, 12) : [],
    totalCents: Math.round(total * 100),
    nightlyCents: Math.round(nightly * 100),
    currency: hotel.currency || "EUR",
    nights,
    adults,
    distanceKm: hotel.distance != null ? Number(hotel.distance) : null,
    boardType: hotel.boardType || null,
    hasFreeCancellation: Boolean(hotel.hasFreeCancellation),
    reviewScore: hotel.reviewScore ?? null,
    status: "STIMA",
    source: "Live · LockTrip",
    url: hotel.hotelId
      ? `https://locktrip.com/hotel/${hotel.hotelId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name || "")}`,
    bookingUrl: hotel.deepLink || hotel.url || "",
    notes: "Disponibilità e prezzo live — verifica capienza gruppo e condizioni sul sito.",
    hostelLike: looksLikeHostel(hotel),
    live: true,
  };
}

function uidFallback() {
  return Math.random().toString(36).slice(2, 10);
}

function nightsBetween(start, end) {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const n = Math.round((b - a) / 86400000);
  return Math.max(1, n);
}

async function searchStays(body) {
  const destination = String(body.destination || "").trim();
  const startDate = String(body.startDate || body.start || body.checkin || "").trim();
  const endDate = String(body.endDate || body.end || body.checkout || "").trim();
  const adults = Math.min(30, Math.max(1, Number(body.adults) || 2));
  const roomCount = Math.min(
    10,
    Math.max(1, Number(body.rooms) || Math.ceil(adults / 2))
  );
  const currency = String(body.currency || "EUR").toUpperCase();
  const nationality = String(body.nationality || "IT").toUpperCase().slice(0, 2);
  const noHostels = body.noHostels !== false;
  const maxResults = Math.min(20, Math.max(5, Number(body.limit) || 10));

  if (!destination || !startDate || !endDate) {
    return json(400, {
      error: "Per gli alloggi servono destinazione, check-in e check-out.",
    });
  }

  const loc = await locktripPost("search_location", { query: destination });
  const locations = Array.isArray(loc.locations) ? loc.locations : [];
  const city =
    locations.find((l) => String(l.type || "").toUpperCase() === "CITY") || locations[0];
  if (!city?.id) {
    return json(404, { error: `Nessuna località trovata per «${destination}».` });
  }

  const rooms = Array.from({ length: roomCount }, () => ({
    adults: Math.max(1, Math.ceil(adults / roomCount)),
  }));
  // redistribute adults across rooms
  let left = adults;
  for (let i = 0; i < rooms.length; i++) {
    const share = i === rooms.length - 1 ? left : Math.max(1, Math.floor(adults / roomCount));
    rooms[i].adults = Math.max(1, share);
    left -= rooms[i].adults;
  }

  const started = await locktripPost("hotel_search", {
    regionId: city.id,
    startDate,
    endDate,
    rooms,
    nationality,
    currency,
  });

  const searchKey = started.searchKey;
  const sessionId = started.sessionId;
  if (!searchKey) {
    return json(502, { error: "Ricerca alloggi non avviata.", detail: started });
  }

  let hotels = [];
  let last = null;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1200));
    last = await locktripPost("get_search_results", {
      searchKey,
      sessionId,
      page: 1,
      sortBy: "PRICE_ASC",
      currency,
    });
    hotels = Array.isArray(last.hotels) ? last.hotels : [];
    const status = String(last.searchStatus || last.status || "").toUpperCase();
    if (hotels.length >= 8 || status === "COMPLETED" || status === "DONE") break;
  }

  const nights = nightsBetween(startDate, endDate);
  let stays = hotels.map((h) => normalizeStay(h, nights, adults));
  if (noHostels) {
    const filtered = stays.filter((s) => !s.hostelLike);
    if (filtered.length) stays = filtered;
  }
  stays = stays.slice(0, maxResults);

  return json(200, {
    ok: true,
    kind: "stays",
    query: {
      destination,
      regionId: city.id,
      regionName: city.fullName || city.name,
      startDate,
      endDate,
      nights,
      adults,
      rooms: roomCount,
      currency,
      noHostels,
    },
    count: stays.length,
    stays,
    fetchedAt: new Date().toISOString(),
    disclaimer:
      "Prezzi live da inventario hotel/appartamenti. Conferma sempre capienza, colazione e cancellazione sul sito.",
  });
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "Metodo non supportato." });
  }

  const body = parseBody(event);
  const action = actionOf(event, body);

  try {
    if (action === "flights" || action === "flight" || action === "voli") {
      return await searchFlights(body);
    }
    if (action === "stays" || action === "hotels" || action === "alloggi") {
      return await searchStays(body);
    }
    return json(400, {
      error: "Azione sconosciuta. Usa action=flights oppure action=stays.",
    });
  } catch (err) {
    return json(err.status && err.status < 600 ? err.status : 502, {
      error: err.message || "Ricerca non riuscita.",
      detail: err.data || undefined,
    });
  }
}
