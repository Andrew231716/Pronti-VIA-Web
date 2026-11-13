/**
 * Personal flight booking lookup: airline + PNR (+ optional flight number).
 * Live enrichment via AviationStack when AVIATIONSTACK_ACCESS_KEY is set;
 * always returns a structured personal booking card + manage URL.
 */

import {
  manageBookingUrl,
  normalizeFlightNumber,
  normalizePnr,
  resolveAirline,
} from "./airlines.mjs";

const BROWSER_UA =
  "Mozilla/5.0 (compatible; ProntiVIA/1.0; +https://github.com/Andrew231716/Pronti-VIA-Web)";

function cleanName(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function isoDate(value) {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function hhmm(value) {
  const s = String(value || "");
  const m = s.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

function buildTitle(airline, flight, from, to, pnr) {
  if (flight?.iata && from && to) return `${flight.iata} · ${from}→${to}`;
  if (flight?.iata) return `${airline.name} ${flight.iata}`;
  if (from && to) return `${airline.name} · ${from}→${to}`;
  return `${airline.name} · ${pnr}`;
}

function buildNotes({ airline, pnr, lastName, flight, live }) {
  const lines = [
    `Prenotazione personale · ${airline.name} (${airline.code})`,
    `PNR / codice: ${pnr}`,
  ];
  if (lastName) lines.push(`Cognome: ${lastName}`);
  if (flight?.iata) lines.push(`Volo: ${flight.iata}`);
  if (live?.status) lines.push(`Stato: ${live.status}`);
  if (live?.departureGate) lines.push(`Gate partenza: ${live.departureGate}`);
  if (live?.arrivalGate) lines.push(`Gate arrivo: ${live.arrivalGate}`);
  lines.push("Visibile solo a te — non condivisa con il gruppo.");
  return lines.join("\n").slice(0, 1500);
}

async function enrichWithAviationStack(flightIata, accessKey) {
  if (!accessKey || !flightIata) return null;
  const url =
    `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(accessKey)}` +
    `&flight_iata=${encodeURIComponent(flightIata)}&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const row = Array.isArray(data?.data) ? data.data[0] : null;
  if (!row) return null;
  const dep = row.departure || {};
  const arr = row.arrival || {};
  return {
    from: String(dep.iata || dep.airport || "").toUpperCase().slice(0, 4),
    to: String(arr.iata || arr.airport || "").toUpperCase().slice(0, 4),
    date: isoDate(dep.scheduled || dep.estimated || ""),
    departTime: hhmm(dep.scheduled || dep.estimated || ""),
    arriveTime: hhmm(arr.scheduled || arr.estimated || ""),
    status: String(row.flight_status || row.status || "").slice(0, 40),
    departureGate: String(dep.gate || "").slice(0, 12),
    arrivalGate: String(arr.gate || "").slice(0, 12),
    airlineName: String(row.airline?.name || "").slice(0, 80),
    source: "aviationstack",
  };
}

/**
 * @param {{ airline: string, pnr: string, lastName?: string, flightNumber?: string, accessKey?: string }} input
 */
export async function lookupFlightBooking(input = {}) {
  const airline = resolveAirline(input.airline);
  if (!airline) {
    const err = new Error("Compagnia non riconosciuta. Prova il nome o il codice IATA (es. AZ, Ryanair).");
    err.code = "AIRLINE_UNKNOWN";
    throw err;
  }
  const pnr = normalizePnr(input.pnr);
  if (pnr.length < 5 || pnr.length > 12) {
    const err = new Error("Il numero prenotazione (PNR) deve avere tra 5 e 12 caratteri.");
    err.code = "PNR_INVALID";
    throw err;
  }
  const lastName = cleanName(input.lastName);
  const flight = normalizeFlightNumber(input.flightNumber, airline.code);
  let live = null;
  let liveError = "";
  if (flight?.iata) {
    try {
      live = await enrichWithAviationStack(flight.iata, input.accessKey || process.env.AVIATIONSTACK_ACCESS_KEY || "");
    } catch (e) {
      liveError = e?.message || "enrichment failed";
    }
  }

  const from = live?.from || "";
  const to = live?.to || "";
  const date = live?.date || "";
  const departTime = live?.departTime || "";
  const arriveTime = live?.arriveTime || "";
  const url = manageBookingUrl(airline, pnr, lastName);
  const title = buildTitle(airline, flight, from, to, pnr);

  const booking = {
    id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "flight",
    visibility: "personal",
    title,
    type: "Volo",
    airline: airline.name,
    airlineCode: airline.code,
    color: airline.color,
    pnr,
    reference: pnr,
    lastName,
    flightNumber: flight?.iata || "",
    date,
    departTime,
    arriveTime,
    from,
    to,
    status: live?.status || (flight ? "In ricerca" : "Da verificare sulla compagnia"),
    notes: buildNotes({ airline, pnr, lastName, flight, live }),
    url,
    source: live?.source || "catalog",
    enriched: Boolean(live),
    updatedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    booking,
    airline: { code: airline.code, name: airline.name, color: airline.color },
    live: Boolean(live),
    liveError: live ? "" : liveError,
    hint: live
      ? "Dettagli volo aggiornati."
      : flight
        ? "Compagnia e PNR salvati. Aggiungi una chiave AviationStack per rotta e orari live, oppure apri Gestisci prenotazione."
        : "Compagnia e PNR salvati. Inserisci anche il numero volo (es. AZ123) per arricchire rotta e orari.",
  };
}

export function validateLookupInput(body = {}) {
  return {
    airline: String(body.airline || "").trim().slice(0, 80),
    pnr: String(body.pnr || body.bookingNumber || body.reference || "").trim().slice(0, 20),
    lastName: String(body.lastName || body.surname || "").trim().slice(0, 80),
    flightNumber: String(body.flightNumber || body.flight || "").trim().slice(0, 12),
  };
}
