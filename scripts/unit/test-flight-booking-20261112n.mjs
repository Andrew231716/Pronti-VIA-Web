#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { resolveAirline, normalizePnr, normalizeFlightNumber, manageBookingUrl } from "../../lib/airlines.mjs";
import { lookupFlightBooking, validateLookupInput } from "../../lib/flight-booking-lookup.mjs";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

ok("resolve ITA by name", resolveAirline("ITA Airways")?.code === "AZ");
ok("resolve Ryanair by alias", resolveAirline("ryan")?.code === "FR");
ok("resolve by IATA", resolveAirline("u2")?.code === "U2");
ok("normalize PNR", normalizePnr("ab c-12d") === "ABC12D");
ok("normalize flight", normalizeFlightNumber("az 0123", "AZ")?.iata === "AZ123");
ok(
  "manage url carries pnr",
  /pnr=ABC12D/i.test(manageBookingUrl(resolveAirline("AZ"), "ABC12D", "Rossi"))
);

const input = validateLookupInput({ airline: "Ryanair", pnr: "XYZ12A", flightNumber: "FR100" });
ok("validate input", input.airline === "Ryanair" && input.pnr === "XYZ12A");

const result = await lookupFlightBooking({ ...input, accessKey: "" });
ok("lookup returns personal booking", result.ok && result.booking.visibility === "personal");
ok("lookup keeps PNR", result.booking.pnr === "XYZ12A" && result.booking.airlineCode === "FR");
ok("lookup type Volo", result.booking.type === "Volo");
ok("lookup has manage url", /^https?:\/\//.test(result.booking.url || ""));

let threw = false;
try {
  await lookupFlightBooking({ airline: "CompagniaInesistenteXYZ", pnr: "ABC12D" });
} catch {
  threw = true;
}
ok("unknown airline throws", threw);

const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const toml = readFileSync("netlify.toml", "utf8");
ok("ux personal scope", /Personali/.test(ux) && /viavia-private-bookings-v1/.test(ux));
ok("ux shared label", /Condivise/.test(ux) && /pv-book-shared-label/.test(ux));
ok("ux flight form", /Cerca e carica/.test(ux) && /lookupPersonalFlight/.test(ux));
ok("netlify route", /\/api\/flight-booking/.test(toml) && existsSync("netlify/functions/flight-booking.mjs"));
ok("stamp ux n", /ux-suite-20261112n\.js/.test(index));
ok("asset exists", existsSync("assets/ux-suite-20261112n.js"));

assert.equal(failed, 0, `${failed} failed`);
console.log("\nOK");
