#!/usr/bin/env node
/**
 * Trip share invite preview: OG landing + clipboard invite message.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const index = readFileSync("index.html", "utf8");
const shim = readFileSync("api-shim.js", "utf8");
const inviteSrc = readFileSync("netlify/functions/invite.mjs", "utf8");
const netlify = readFileSync("netlify.toml", "utf8");
const vercel = readFileSync("vercel.json", "utf8");
const share = readFileSync("netlify/functions/share.mjs", "utf8");

test("api-shim stamp + OG defaults wired", () => {
  assert.match(index, /api-shim-20261112q\.js/);
  assert.match(index, /og:title/);
  assert.match(index, /og:description/);
});

test("invito route wired on Netlify + Vercel", () => {
  assert.match(netlify, /from = "\/invito\/\*"/);
  assert.match(netlify, /\.netlify\/functions\/invite/);
  assert.match(vercel, /\/invito\/:id\*/);
  assert.match(inviteSrc, /og:title/);
  assert.match(inviteSrc, /Sei invitato/);
});

test("share API preview includes invite message fields", () => {
  assert.match(share, /inviteTitle/);
  assert.match(share, /inviteMessage/);
  assert.match(share, /Sei invitato/);
});

test("shim builds invite clipboard / share payload", () => {
  assert.match(shim, /buildInviteSharePayload/);
  assert.match(shim, /toInvitePreviewUrl/);
  assert.match(shim, /__pvBuildInviteShare/);
  assert.match(shim, /\/invito\//);
  assert.match(shim, /Apri l'invito su Pronti\? VIA!/);
});

test("invite HTML helpers render OG + redirect hash", () => {
  // Evaluate pure helpers without importing @netlify/blobs via _store.
  const start = inviteSrc.indexOf("function escapeHtml");
  const end = inviteSrc.indexOf("export async function handler");
  assert.ok(start > 0 && end > start, "helper block found");
  const sandbox = { Intl, URLSearchParams };
  vm.createContext(sandbox);
  vm.runInContext(
    `${inviteSrc.slice(start, end)}\nthis.buildInviteCopy=buildInviteCopy;this.renderInviteHtml=renderInviteHtml;`,
    sandbox
  );
  const copy = sandbox.buildInviteCopy({
    title: "Accra 2027",
    destination: "Accra",
    start: "2027-07-11",
    end: "2027-07-18",
  });
  assert.match(copy.title, /^Invito · Accra 2027$/);
  assert.match(copy.headline, /Sei invitato a «Accra 2027»/);
  assert.match(copy.description, /Accra/);

  const html = sandbox.renderInviteHtml({
    origin: "https://pronti-via-k7es.netlify.app",
    shareId: "abc123",
    record: {
      id: "trip-1",
      viewToken: "viewtok",
      trip: { title: "Accra 2027", destination: "Accra", start: "2027-07-11", end: "2027-07-18" },
    },
    missing: false,
  });
  assert.match(html, /property="og:title"/);
  assert.match(html, /Invito · Accra 2027/);
  assert.match(html, /Sei invitato a «Accra 2027»/);
  assert.match(html, /trip=trip-1/);
  assert.match(html, /key=viewtok/);
  assert.match(html, /s=n%3Aabc123|s=n:abc123/);
});

test("shim invite URL helper prefers /invito for n: refs", () => {
  const sandbox = {
    window: {},
    location: {
      origin: "https://example.test",
      href: "https://example.test/",
      pathname: "/",
      hash: "",
      search: "",
      hostname: "example.test",
    },
    localStorage: {
      _d: {
        "viavia-local-trips-v1": JSON.stringify({
          "trip-1": {
            id: "trip-1",
            key: "edit",
            viewToken: "view",
            trip: { title: "Roma", destination: "Roma", start: "2026-12-01", end: "2026-12-05" },
          },
        }),
        "viavia-share-blobs-v1": "{}",
        "viavia-outbox-v1": "[]",
      },
      getItem(k) {
        return this._d[k] ?? null;
      },
      setItem(k, v) {
        this._d[k] = String(v);
      },
      removeItem(k) {
        delete this._d[k];
      },
    },
    navigator: { onLine: true, clipboard: null },
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      head: { appendChild() {} },
      body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
      documentElement: { style: {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    fetch: async () => ({ ok: true, json: async () => ({}), clone() { return this; }, headers: { get: () => "" } }),
    URL,
    URLSearchParams,
    Intl,
    console,
    btoa,
    atob,
    setTimeout,
    clearTimeout,
    setInterval() {},
    clearInterval() {},
    history: { replaceState() {} },
    addEventListener() {},
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000099", getRandomValues: (a) => a },
    TextEncoder,
    TextDecoder,
    Response,
    Request,
    Headers,
    AbortController,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(shim, sandbox);
  const enriched = "https://example.test/#trip=trip-1&key=edit&s=n:shareXYZ";
  const preview = sandbox.window.__pvToInvitePreviewUrl(enriched);
  assert.equal(preview, "https://example.test/invito/shareXYZ");
  const payload = sandbox.window.__pvBuildInviteShare(enriched);
  assert.match(payload.title, /Invito · Roma/);
  assert.match(payload.text, /Sei invitato a «Roma»/);
  assert.match(payload.text, /https:\/\/example\.test\/invito\/shareXYZ/);
  assert.equal(payload.url, "https://example.test/invito/shareXYZ");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
