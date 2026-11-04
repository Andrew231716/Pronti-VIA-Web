#!/usr/bin/env node
/**
 * RC 20261104b — persistence honesty, roles, outbox helpers.
 */
import assert from "node:assert/strict";
import {
  classifyPersistence,
  SaveStatus,
  saveToastFromResponse,
  SAVE_MSG,
  enqueueOutbox,
  removeFromOutbox,
  detectConflict,
} from "../../lib/sync-state.mjs";
import {
  can,
  ROLES,
  assertMutationAllowed,
  permissionForMutation,
  roleMapFromTrip,
  normalizeRole,
} from "../../lib/roles.mjs";
import { isAllowedOrigin, resolveAllowOrigin, corsHeadersFor } from "../../lib/cors.mjs";
import { readFileSync, existsSync } from "node:fs";

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

test("toast server vs local", () => {
  assert.equal(saveToastFromResponse({ local: false, source: "blobs" }), SAVE_MSG.SERVER);
  assert.equal(saveToastFromResponse({ local: true }), SAVE_MSG.LOCAL);
  assert.equal(saveToastFromResponse({ source: "memory" }), SAVE_MSG.LOCAL);
  assert.equal(
    saveToastFromResponse({ local: false, source: "supabase" }, { create: true }),
    SAVE_MSG.CREATE_SERVER
  );
  assert.equal(saveToastFromResponse({ local: true }, { create: true }), SAVE_MSG.CREATE_LOCAL);
});

test("classifyPersistence", () => {
  assert.equal(classifyPersistence({ source: "memory" }), SaveStatus.LOCAL);
  assert.equal(classifyPersistence({ local: false, source: "store" }), SaveStatus.SERVER);
});

test("outbox enqueue dedupe + remove", () => {
  let q = [];
  q = enqueueOutbox(q, { type: "trip-put", tripId: "t1", payload: { a: 1 } });
  q = enqueueOutbox(q, { type: "trip-put", tripId: "t1", payload: { a: 2 } });
  assert.equal(q.length, 1);
  assert.equal(q[0].payload.a, 2);
  q = removeFromOutbox(q, q[0].id);
  assert.equal(q.length, 0);
});

test("conflict detect", () => {
  assert.equal(detectConflict(1, 2), true);
  assert.equal(detectConflict(3, 3), false);
});

test("roles IT aliases + permissions", () => {
  assert.equal(normalizeRole("visualizzatore"), ROLES.READONLY);
  assert.equal(normalizeRole("collaboratore"), ROLES.MEMBER);
  assert.equal(can(ROLES.READONLY, "edit"), false);
  assert.equal(can(ROLES.MEMBER, "edit"), true);
  assert.equal(can(ROLES.MEMBER, "delete"), false);
  assert.equal(can(ROLES.OWNER, "roles"), true);
  assert.equal(can(ROLES.READONLY, "polls-vote"), true);
});

test("assertMutationAllowed legacy vs readonly", () => {
  const trip = {
    members: [{ id: "m1", name: "Owner" }, { id: "m2", name: "View" }],
    meta: { roles: { m1: "owner", m2: "readonly" } },
  };
  assert.equal(assertMutationAllowed(trip, "", "edit").ok, true); // legacy
  assert.equal(assertMutationAllowed(trip, "m2", "edit").ok, false);
  assert.equal(assertMutationAllowed(trip, "m1", "delete").ok, true);
  assert.equal(assertMutationAllowed(trip, "m2", "polls-vote").ok, true);
});

test("permissionForMutation roles change", () => {
  const prev = { m1: "owner" };
  const next = { trip: { meta: { roles: { m1: "owner", m2: "member" } } }, __prevRoles: prev };
  assert.equal(permissionForMutation("PUT", next), "roles");
  assert.equal(permissionForMutation("PUT", { trip: { title: "x" } }), "edit");
  assert.equal(permissionForMutation("DELETE", {}), "delete");
});

test("SPA bundle no longer hardcodes Salvato per tutti", () => {
  const p = "assets/index-loadfix-20261104b.js";
  assert.equal(existsSync(p), true);
  const spa = readFileSync(p, "utf8");
  assert.equal(spa.includes("Salvato per tutti"), false);
  assert.equal(spa.includes("__pvSaveToast"), true);
  assert.equal(spa.includes("__pvCreateToast"), true);
});

test("api-shim exposes toast helpers", () => {
  const shim = readFileSync("api-shim.js", "utf8");
  assert.match(shim, /__pvSaveToast/);
  assert.match(shim, /__pvFlushOutbox/);
  assert.match(shim, /Salvato e sincronizzato/);
});

test("CORS allowlist: Pages/Netlify/localhost; reject open vercel/netlify", () => {
  assert.equal(isAllowedOrigin("https://andrew231716.github.io"), true);
  assert.equal(isAllowedOrigin("https://pronti-via-k7es.netlify.app"), true);
  assert.equal(isAllowedOrigin("https://demo.vercel.app"), false);
  assert.equal(isAllowedOrigin("https://evil-attacker.vercel.app"), false);
  assert.equal(isAllowedOrigin("https://evil-attacker.netlify.app"), false);
  assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  assert.equal(isAllowedOrigin("*"), false);
  assert.equal(resolveAllowOrigin("https://evil.example.com"), null);
  assert.equal(resolveAllowOrigin(""), null);
  const denied = corsHeadersFor({ headers: { origin: "https://foo.vercel.app" } });
  assert.equal(denied["Access-Control-Allow-Origin"], undefined);
  const ok = corsHeadersFor({ headers: { origin: "https://andrew231716.github.io" } });
  assert.equal(ok["Access-Control-Allow-Origin"], "https://andrew231716.github.io");
  assert.match(ok["Access-Control-Allow-Headers"], /X-Pronti-Member-Id/);
  for (const file of [
    "netlify/functions/account.mjs",
    "netlify/functions/trips.mjs",
    "netlify/functions/share.mjs",
    "netlify/functions/places.mjs",
    "netlify/functions/proxy.mjs",
    "netlify/functions/search.mjs",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes('Access-Control-Allow-Origin": "*"'), false, `${file} wildcard`);
    assert.match(src, /lib\/cors\.mjs/);
  }
});

test("trips.mjs enforces roles via assertMutationAllowed", () => {
  const src = readFileSync("netlify/functions/trips.mjs", "utf8");
  assert.match(src, /assertMutationAllowed/);
  assert.match(src, /X-Pronti-Member-Id|x-pronti-member-id/);
  assert.match(src, /json\(403/);
  assert.match(src, /json\(409/);
});

test("outbox flush does not mark sync before server confirm", () => {
  const shim = readFileSync("api-shim.js", "utf8");
  assert.match(shim, /still-local/);
  assert.match(shim, /res\.status === 409/);
  assert.match(shim, /flushed \+= 1/);
  assert.match(shim, /pv-save-status/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
