#!/usr/bin/env node
/**
 * Event/congress import parser + UI wiring (paste + file path).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
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

test("stamp ux-suite-20261111o wired", () => {
  assert.match(index, /ux-suite-20261111o\.js/);
});

test("import event menu + wizard wired", () => {
  assert.match(ux, /import-event/);
  assert.match(ux, /openEventImportWizard/);
  assert.match(ux, /parseEventImportText/);
  assert.match(ux, /readImportFile/);
  assert.match(ux, /multiple/);
  assert.match(ux, /createTripForImport/);
  assert.match(ux, /injectEventImportRail/);
  assert.match(ux, /Aggiungi da evento/);
  assert.match(ux, /Carica uno o più file/);
  assert.match(ux, /Crea un nuovo viaggio/);
});

// Evaluate parser helpers in a sandbox by extracting and running the suite with stubs.
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
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(ux.replace("  window.__pvParseEventImport", "  window.testSectionImport = applySectionEventImport;\n  window.__pvParseEventImport"), sandbox);

test("scoped event imports only update the chosen section", () => {
  const apply = sandbox.testSectionImport;
  const original = { title: "Accra", stops: [], bookings: [], checklist: [], notes: "Originali" };
  const items = [
    { kind: "stop", title: "Black Star Square", payload: { stop: { title: "Black Star Square", day: "2027-08-02", time: "09:30" } } },
    { kind: "checklist", title: "Badge", payload: { checklist: { title: "Badge" } } },
    { kind: "note", title: "Nota", payload: { note: "Contatto" } },
    { kind: "doc", title: "Biglietto", payload: { doc: { url: "https://example.org/biglietto" } } },
  ];
  const itinerary = apply(original, items, "itinerary").trip;
  assert.equal(itinerary.stops[0].day, "2027-08-02");
  assert.equal(itinerary.notes, original.notes);
  assert.equal(itinerary.checklist.length, 0);
  const places = apply(original, items, "places").trip;
  assert.equal(places.stops[0].day, undefined);
  assert.equal(places.stops[0].time, undefined);
  const explore = apply(original, items, "explore").trip;
  assert.equal(explore.stops.length, 0);
  assert.equal(explore.meta.eventExplore[0].title, "Black Star Square");
  const documents = apply(original, items, "documents").trip;
  assert.equal(documents.meta.eventDocumentLinks[0].url, "https://example.org/biglietto");
  assert.equal(documents.notes, original.notes);
  const packing = apply(original, items, "packing").trip;
  assert.equal(packing.checklist[0].title, "Badge");
  assert.equal(packing.meta, undefined);
});

test("parse hotel + program + checklist + link", () => {
  const text = `
PROGRAMMA
12/07/2027 09:30 Sessione mattutina
Hotel Grand Plaza check-in 11 luglio 2027
- [ ] Portare badge congresso
Documento iscrizione https://hub.jw.org/event-management/it/example
Trasferimento navetta aeroporto 08:00
`;
  const items = sandbox.window.__pvParseEventImport(text);
  assert.ok(items.length >= 4, `expected >=4 got ${items.length}`);
  assert.ok(items.some((i) => i.kind === "stop"));
  assert.ok(items.some((i) => i.kind === "booking"));
  assert.ok(items.some((i) => i.kind === "checklist"));
  assert.ok(items.some((i) => i.kind === "doc" && /hub\.jw\.org/.test(i.detail || i.payload?.doc?.url || "")));
});

test("parse ICS VEVENT", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Assemblea internazionale
DTSTART:20270712T093000
LOCATION:Arena
END:VEVENT
END:VCALENDAR`;
  const items = sandbox.window.__pvParseEventImport(ics);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "stop");
  assert.match(items[0].title, /Assemblea/);
});

test("parse JSON trip payload", () => {
  const items = sandbox.window.__pvParseEventImport(
    JSON.stringify({
      trip: {
        notes: "Info utili",
        stops: [{ title: "Venue", day: "2027-07-12", time: "10:00", category: "Visita" }],
        bookings: [{ title: "Hotel Centro", type: "Alloggio", date: "2027-07-11" }],
        checklist: [{ title: "Passaporto" }],
      },
    })
  );
  assert.ok(items.some((i) => i.kind === "stop"));
  assert.ok(items.some((i) => i.kind === "booking"));
  assert.ok(items.some((i) => i.kind === "checklist"));
  assert.ok(items.some((i) => i.kind === "note"));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
