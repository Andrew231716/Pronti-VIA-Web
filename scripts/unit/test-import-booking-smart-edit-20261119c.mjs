#!/usr/bin/env node
/**
 * Smart booking document detection + editable review before insert.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

test("stamp ux-suite 20261119d", () => {
  assert.match(index, /ux-suite-20261119o\.js/);
  assert.match(sw, /ux-suite-20261119o\.js/);
  assert.ok(existsSync("assets/ux-suite-20261119o.js"));
  assert.match(ux, /const STYLE_VER = "20261119o"/);
});

test("edit-before-insert UI wired", () => {
  assert.match(ux, /Modifica prima di inserire/);
  assert.match(ux, /syncImportEditsFromDom/);
  assert.match(ux, /renderBookingEditFields/);
  assert.match(ux, /name="reference"/);
  assert.match(ux, /BOOKING_TYPE_OPTIONS/);
});

test("smart document summarizers present", () => {
  assert.match(ux, /summarizeBookingDocument/);
  assert.match(ux, /summarizeFlightDocument/);
  assert.match(ux, /summarizeTrainDocument/);
  assert.match(ux, /extractBookingReference/);
  assert.match(ux, /prefersDocumentSummary/);
});

const sandbox = {
  window: { __pvUxSuiteBound: false },
  document: {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      setAttribute() {},
      appendChild() {},
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    }),
    head: { appendChild() {} },
    body: {
      appendChild() {},
      classList: { toggle() {}, add() {}, contains() { return false; } },
    },
    documentElement: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
  },
  localStorage: {
    _d: {},
    getItem(k) {
      return this._d[k] ?? null;
    },
    setItem(k, v) {
      this._d[k] = String(v);
    },
  },
  location: { hash: "", href: "http://localhost/" },
  navigator: { onLine: true },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  MutationObserver: class {
    observe() {}
  },
  addEventListener() {},
  setTimeout,
  clearTimeout,
  setInterval() {},
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
  URL,
  URLSearchParams,
  Intl,
  console,
  CSS: { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&") },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(ux, sandbox);

test("detect flight confirmation as Volo with PNR", () => {
  const text = `
Booking confirmation
PNR: ABC12D
Flight AZ 608
FCO → JFK
Departure 12/07/2027 09:30
Airline: ITA Airways
`;
  const items = sandbox.window.__pvSummarizeBookingDocument(text, "booking");
  assert.ok(items && items.length === 1, `expected 1 item got ${items?.length}`);
  assert.equal(items[0].kind, "booking");
  assert.equal(items[0].payload.booking.type, "Volo");
  assert.equal(items[0].payload.booking.reference, "ABC12D");
  assert.match(items[0].payload.booking.date, /2027-07-12|2027-12-07/);
  assert.match(items[0].guess || "", /volo/i);
});

test("detect train ticket", () => {
  const text = `
Trenitalia — biglietto treno
Da Milano Centrale a Roma Termini
Codice prenotazione: TRN45K
12 luglio 2027 ore 08:15
Carrozza 5 posto 12
`;
  const items = sandbox.window.__pvSummarizeBookingDocument(text, "booking");
  assert.ok(items?.length === 1);
  assert.equal(items[0].payload.booking.type, "Treno");
  assert.equal(items[0].payload.booking.reference, "TRN45K");
  assert.match(items[0].title, /Milano|Roma|Trenitalia/i);
});

test("parseEventImport prefers document summary for confirmations", () => {
  const text = `
Conferma di prenotazione
Hotel Name: Grand Plaza
Check-in date 11/07/2027 14:00
Check-out date 14/07/2027 11:00
Booking reference: HT12345
Hotel Address: Via Roma 1
`;
  const items = sandbox.window.__pvParseEventImport(text);
  assert.ok(items.some((i) => i.kind === "booking"));
  const book = items.find((i) => i.kind === "booking");
  assert.equal(book.payload.booking.type, "Alloggio");
  assert.ok(book.guess);
});

test("program text still yields mixed kinds", () => {
  const text = `
PROGRAMMA
12/07/2027 09:30 Sessione mattutina
12/07/2027 14:00 Sessione pomeridiana
12/07/2027 18:00 Assemblea
Hotel Grand Plaza check-in 11 luglio 2027
- [ ] Portare badge congresso
`;
  const items = sandbox.window.__pvParseEventImport(text);
  assert.ok(items.some((i) => i.kind === "stop"));
  assert.ok(items.some((i) => i.kind === "booking") || items.some((i) => i.kind === "checklist"));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
