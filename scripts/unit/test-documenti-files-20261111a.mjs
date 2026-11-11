#!/usr/bin/env node
/**
 * Documenti blank-page guard: /files must never return bare trip JSON to the UI.
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

const shim = readFileSync("api-shim.js", "utf8");
const asset = readFileSync("assets/api-shim-20261111f.js", "utf8");
const tripsFn = readFileSync("netlify/functions/trips.mjs", "utf8");
const index = readFileSync("index.html", "utf8");

test("api-shim stamp wired", () => {
  assert.match(index, /api-shim-20261111f\.js/);
  assert.equal(shim, asset);
});

test("shim guards unusable /files payloads on same-origin + remote", () => {
  assert.match(shim, /isUsableTripFilesPayload/);
  assert.match(shim, /filesPayloadUnusable/);
  assert.match(shim, /Documenti UI requires/);
  assert.match(shim, /FILES_LOCAL_ONLY|Allegati gestiti sul dispositivo|handleLocalTrips/);
});

test("Netlify trips store never returns trip JSON for /files", () => {
  assert.match(tripsFn, /sub === "files"/);
  assert.match(tripsFn, /FILES_LOCAL_ONLY/);
  assert.match(tripsFn, /blank white page|crashes when `files` is missing/);
});

// Evaluate helper in isolation
const helperSrc = shim.match(
  /function isUsableTripFilesPayload\(method, filesParts, data\) \{[\s\S]*?\n  \}/
)?.[0];
assert.ok(helperSrc, "helper extractable");
const sandbox = {};
vm.runInNewContext(`${helperSrc}; this.isUsableTripFilesPayload = isUsableTripFilesPayload;`, sandbox);

test("trip JSON is not a usable files list", () => {
  assert.equal(
    sandbox.isUsableTripFilesPayload("GET", ["trip-1", "files"], { trip: { title: "X" }, id: "trip-1" }),
    false
  );
});

test("files array is usable", () => {
  assert.equal(sandbox.isUsableTripFilesPayload("GET", ["trip-1", "files"], { files: [] }), true);
  assert.equal(
    sandbox.isUsableTripFilesPayload("GET", ["trip-1", "files"], { files: [{ id: "a", name: "a.pdf", size: 1 }] }),
    true
  );
});

test("upload/delete shapes", () => {
  assert.equal(sandbox.isUsableTripFilesPayload("POST", ["t", "files"], { ok: true, file: { id: "1" } }), true);
  assert.equal(sandbox.isUsableTripFilesPayload("POST", ["t", "files"], { trip: {} }), false);
  assert.equal(sandbox.isUsableTripFilesPayload("DELETE", ["t", "files", "f1"], { deleted: true }), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
