/**
 * Airline catalog for personal flight bookings (IATA + manage-booking deep links).
 * Used by flight-booking lookup — keep names searchable in IT/EN.
 */

export const AIRLINES = Object.freeze([
  { code: "AZ", name: "ITA Airways", aliases: ["ita", "alitalia", "ita airways"], color: "#0b2c5e", manage: "https://www.ita-airways.com/it_it/manage-booking.html" },
  { code: "FR", name: "Ryanair", aliases: ["ryanair", "ryan"], color: "#073590", manage: "https://www.ryanair.com/it/it/trip/manage" },
  { code: "U2", name: "easyJet", aliases: ["easyjet", "easy jet", "ej"], color: "#ff6600", manage: "https://www.easyjet.com/it/manage" },
  { code: "W6", name: "Wizz Air", aliases: ["wizz", "wizzair", "wizz air"], color: "#c6007e", manage: "https://www.wizzair.com/it-it/gestione-prenotazione" },
  { code: "VY", name: "Vueling", aliases: ["vueling"], color: "#ffcc00", manage: "https://tickets.vueling.com/Search.aspx" },
  { code: "LH", name: "Lufthansa", aliases: ["lufthansa"], color: "#05164d", manage: "https://www.lufthansa.com/it/it/my-bookings" },
  { code: "AF", name: "Air France", aliases: ["air france", "airfrance"], color: "#002157", manage: "https://wwws.airfrance.it/trip" },
  { code: "KL", name: "KLM", aliases: ["klm", "royal dutch"], color: "#00a1e4", manage: "https://www.klm.it/trip" },
  { code: "BA", name: "British Airways", aliases: ["british", "british airways", "ba"], color: "#075aaa", manage: "https://www.britishairways.com/travel/managebooking/public/it_it" },
  { code: "EK", name: "Emirates", aliases: ["emirates"], color: "#d71a21", manage: "https://www.emirates.com/it/italian/manage-booking/" },
  { code: "QR", name: "Qatar Airways", aliases: ["qatar", "qatar airways"], color: "#5c0632", manage: "https://www.qatarairways.com/it-it/homepage.html" },
  { code: "TK", name: "Turkish Airlines", aliases: ["turkish", "thy"], color: "#c70a0c", manage: "https://www.turkishairlines.com/it-int/any-questions/manage-booking/" },
  { code: "LX", name: "SWISS", aliases: ["swiss", "swiss air"], color: "#e60000", manage: "https://www.swiss.com/it/it/manage-booking" },
  { code: "OS", name: "Austrian Airlines", aliases: ["austrian"], color: "#e2001a", manage: "https://www.austrian.com/it/it/manage-booking" },
  { code: "IB", name: "Iberia", aliases: ["iberia"], color: "#d7192d", manage: "https://www.iberia.com/it/gestisci-prenotazione/" },
  { code: "TP", name: "TAP Air Portugal", aliases: ["tap", "tap portugal"], color: "#008c45", manage: "https://www.flytap.com/it-it/gestisci-prenotazione" },
  { code: "EW", name: "Eurowings", aliases: ["eurowings"], color: "#8b1d41", manage: "https://www.eurowings.com/it/prenota/le-mie-prenotazioni.html" },
  { code: "PC", name: "Pegasus", aliases: ["pegasus"], color: "#f7a800", manage: "https://www.flypgs.com/en/manage-booking" },
  { code: "XQ", name: "SunExpress", aliases: ["sunexpress", "sun express"], color: "#e30613", manage: "https://www.sunexpress.com/it/manage-booking/" },
  { code: "A3", name: "Aegean Airlines", aliases: ["aegean"], color: "#0b3b7a", manage: "https://en.aegeanair.com/manage-booking/" },
  { code: "DY", name: "Norwegian", aliases: ["norwegian"], color: "#d81939", manage: "https://www.norwegian.com/it/gestione-prenotazione/" },
  { code: "SK", name: "SAS", aliases: ["sas", "scandinavian"], color: "#000000", manage: "https://www.flysas.com/en-en/manage-booking/" },
  { code: "SN", name: "Brussels Airlines", aliases: ["brussels"], color: "#003d7c", manage: "https://www.brusselsairlines.com/it/it/manage-booking" },
  { code: "UX", name: "Air Europa", aliases: ["air europa"], color: "#003399", manage: "https://www.aireuropa.com/it/it/myb" },
  { code: "EI", name: "Aer Lingus", aliases: ["aer lingus"], color: "#006666", manage: "https://www.aerlingus.com/manage-booking/" },
  { code: "AA", name: "American Airlines", aliases: ["american", "american airlines"], color: "#0078d2", manage: "https://www.aa.com/reservation/view/find-your-reservation" },
  { code: "DL", name: "Delta Air Lines", aliases: ["delta"], color: "#003366", manage: "https://www.delta.com/mytrips/findPnr.action" },
  { code: "UA", name: "United Airlines", aliases: ["united"], color: "#002244", manage: "https://www.united.com/en/us/manageres" },
  { code: "AC", name: "Air Canada", aliases: ["air canada"], color: "#f01428", manage: "https://www.aircanada.com/aeroplan/managebooking" },
  { code: "QF", name: "Qantas", aliases: ["qantas"], color: "#e0001b", manage: "https://www.qantas.com/it/en/manage-booking.html" },
]);

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Resolve airline from IATA code or free-text name. */
export function resolveAirline(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(upper)) {
    const byCode = AIRLINES.find((a) => a.code === upper);
    if (byCode) return { ...byCode };
  }
  const q = norm(raw);
  if (!q) return null;
  let hit = AIRLINES.find((a) => norm(a.name) === q || a.aliases.some((x) => norm(x) === q));
  if (hit) return { ...hit };
  hit = AIRLINES.find(
    (a) =>
      norm(a.name).includes(q) ||
      q.includes(norm(a.name)) ||
      a.aliases.some((x) => norm(x).includes(q) || q.includes(norm(x)))
  );
  return hit ? { ...hit } : null;
}

export function normalizePnr(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/** Accept AZ123, AZ 123, az0123 → { airlineCode?, number, iata } */
export function normalizeFlightNumber(value, airlineCode = "") {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!raw) return null;
  const m = raw.match(/^([A-Z0-9]{2})?(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  const code = m[1] || String(airlineCode || "").toUpperCase();
  const num = m[2].replace(/^0+/, "") || m[2];
  if (!code || !/^\d/.test(num)) return null;
  return { airlineCode: code, number: num, iata: `${code}${num}` };
}

export function manageBookingUrl(airline, pnr = "", lastName = "") {
  if (!airline?.manage) return "";
  try {
    const u = new URL(airline.manage);
    if (pnr) {
      u.searchParams.set("pnr", pnr);
      u.searchParams.set("recordLocator", pnr);
      u.searchParams.set("bookingReference", pnr);
    }
    if (lastName) {
      u.searchParams.set("lastName", lastName);
      u.searchParams.set("surname", lastName);
    }
    return u.toString();
  } catch {
    return airline.manage;
  }
}
