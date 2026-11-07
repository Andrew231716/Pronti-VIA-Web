import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const load = (name, context) =>
  runInNewContext(readFileSync(new URL(`../../${name}`, import.meta.url), "utf8"), context);

const location = new URL("https://andrew231716.github.io/Pronti-VIA-Web/");

test("Pages retries the newest offline edit with its original server revision", async () => {
  const id = "test-trip";
  const key = "test-edit-key";
  const localKey = "viavia-local-trips-v1";
  const storage = new Map([[localKey, JSON.stringify({
    [id]: { key, revision: 3, trip: { title: "Initial" }, local: false },
  })]]);
  const navigator = { onLine: false };
  const url = `/api/trips/${id}`;
  const uploads = [];
  const events = [];
  let serverStatus = 200;
  let durable = false;
  const window = {
    async fetch(target, init) {
      if (!navigator.onLine) throw new Error("Offline");
      if (target !== `https://pronti-via-k7es.netlify.app${url}`) throw new Error("Unexpected route");
      const { trip, revision, actorMemberId } = JSON.parse(init.body);
      uploads.push({ trip, revision, actorMemberId });
      return Response.json({ trip, revision: 4, durable, local: !durable }, { status: serverStatus });
    },
    addEventListener() {},
    dispatchEvent(event) { events.push(event); },
  };
  load("api-shim.js", {
    window, location, navigator, URL, URLSearchParams, Headers, Response, AbortController,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    setInterval() {},
    setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
    localStorage: {
      getItem: (name) => storage.get(name) ?? null,
      setItem: (name, value) => storage.set(name, value),
    },
  });

  const headers = { Authorization: `Bearer ${key}`, "X-Pronti-Member-Id": "member-1" };
  for (const [revision, title] of [[3, "First edit"], [4, "Latest edit"]]) {
    const response = await window.fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ trip: { title, budget: 12000 }, revision }),
    });
    assert.equal((await response.json()).revision, revision + 1);
  }

  navigator.onLine = true;
  const pending = await (await window.fetch(url, { headers })).json();
  assert.equal(pending.trip.title, "Latest edit");
  assert.equal(pending.trip.budget, 12000);
  assert.equal(pending.local, true);

  const localResult = await window.__pvFlushOutbox();
  assert.equal(localResult.left, 1);
  assert.deepEqual(uploads[0], {
    trip: { title: "Latest edit", budget: 0 }, revision: 3, actorMemberId: "member-1",
  });
  assert.equal(events.some(event => event.detail.local === false), false);

  serverStatus = 409;
  assert.equal((await window.__pvFlushOutbox()).left, 1);
  assert.equal(window.__pvReadOutbox()[0].lastError, "conflict");
  assert.equal(events.some(event => event.detail.conflict), true);

  serverStatus = 200;
  durable = true;
  assert.equal((await window.__pvFlushOutbox()).flushed, 1);
  assert.equal(window.__pvReadOutbox().length, 0);
  assert.equal(JSON.parse(storage.get(localKey))[id].revision, 4);
  assert.equal(events.some(event => event.detail.local === false), true);
});

test("service worker keeps other apps' caches and falls back to its scoped page", async () => {
  const listeners = new Map();
  const deleted = [];
  const shell = new Response("Cached app");
  const cache = {
    addAll: async () => { throw new Error("Precache unavailable"); },
    match: async (request) => request === new URL("index.html", location).href ? shell : undefined,
  };
  let skippedWaiting = false;
  load("sw.js", {
    URL, Response,
    Request: class {},
    fetch: async () => new Response("Upstream unavailable", { status: 503 }),
    caches: {
      open: async () => cache,
      keys: async () => ["pv-shell-20261104j", "another-app"],
      delete: async (key) => deleted.push(key),
    },
    self: {
      registration: { scope: location.href },
      clients: { claim() {} },
      skipWaiting: () => { skippedWaiting = true; },
      addEventListener: (type, listener) => listeners.set(type, listener),
    },
  });
  let waiting;
  const waitUntil = (promise) => { waiting = promise; };
  listeners.get("install")({ waitUntil });
  await assert.rejects(waiting, /Precache unavailable/);
  assert.equal(skippedWaiting, false);

  listeners.get("activate")({ waitUntil });
  await waiting;
  assert.deepEqual(deleted, ["pv-shell-20261104j"]);

  let handled;
  const navigate = (url) => listeners.get("fetch")({
    request: { method: "GET", mode: "navigate", url },
    respondWith: (promise) => { handled = promise; },
  });
  navigate(new URL("/other-app/", location).href);
  assert.equal(handled, undefined);
  navigate(new URL("?v=test", location).href);
  assert.equal(await handled, shell);
});
