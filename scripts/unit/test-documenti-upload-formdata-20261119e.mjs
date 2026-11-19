#!/usr/bin/env node
/**
 * Documenti upload: FormData must survive rewriteTripWriteInit (was becoming empty JSON).
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

const shim = readFileSync("api-shim.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

test("stamp api-shim 20261119e wired", () => {
  assert.match(index, /api-shim-20261119e\.js/);
  assert.match(sw, /api-shim-20261119e\.js/);
  assert.ok(existsSync("assets/api-shim-20261119e.js"));
  assert.equal(shim, readFileSync("assets/api-shim-20261119e.js", "utf8"));
});

test("rewrite guards FormData /files uploads", () => {
  assert.match(shim, /Documenti uploads POST multipart FormData/);
  assert.match(shim, /Nessun file ricevuto/);
  assert.match(shim, /init\.body instanceof FormData/);
  assert.match(shim, /\/files\(\?:\\\/\|\$\)/);
});

// Extract rewriteTripWriteInit into a sandbox with FormData.
const fnSrc = shim.match(/async function rewriteTripWriteInit\(pathname, init = \{\}\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(fnSrc, "rewriteTripWriteInit extractable");

class FakeFormData {
  constructor() {
    this._m = new Map();
  }
  append(k, v) {
    this._m.set(k, v);
  }
  get(k) {
    return this._m.get(k) ?? null;
  }
}

const sandbox = {
  FormData: FakeFormData,
  Blob: class FakeBlob {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(`${fnSrc}\nthis.rewriteTripWriteInit = rewriteTripWriteInit;`, sandbox);

test("FormData body on /files is left intact", async () => {
  const fd = new FakeFormData();
  const file = { name: "passaporto.pdf", size: 12, arrayBuffer: async () => new ArrayBuffer(12) };
  fd.append("file", file);
  const init = { method: "POST", body: fd, headers: { Authorization: "Bearer k" } };
  const out = await sandbox.rewriteTripWriteInit("/api/trips/abc/files", init);
  assert.equal(out.body, fd, "FormData must not be replaced");
  assert.equal(out.body.get("file"), file);
});

test("plain FormData (no path) is left intact", async () => {
  const fd = new FakeFormData();
  fd.append("file", { name: "x.pdf", size: 1, arrayBuffer: async () => new ArrayBuffer(1) });
  const out = await sandbox.rewriteTripWriteInit("/api/trips/abc", {
    method: "POST",
    body: fd,
  });
  assert.equal(out.body, fd);
});

test("trip create JSON still rewritten", async () => {
  const out = await sandbox.rewriteTripWriteInit("/api/trips", {
    method: "POST",
    body: JSON.stringify({ title: "Roma", budget: 100, checklist: [{ title: "A" }] }),
  });
  const parsed = JSON.parse(out.body);
  assert.equal(parsed.budget, 0);
  assert.deepEqual(parsed.checklist, []);
  assert.equal(parsed.title, "Roma");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
