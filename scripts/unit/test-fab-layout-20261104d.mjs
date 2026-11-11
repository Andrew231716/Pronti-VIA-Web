#!/usr/bin/env node
/**
 * FAB / Hub layout: Hub integrated in top nav; bacchetta stays on the right.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const plat = readFileSync("pv-platform.js", "utf8");
const magic = readFileSync("magic-extras.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const account = readFileSync("account.js", "utf8");
const index = readFileSync("index.html", "utf8");

test("Hub integrated in primary nav (#pv-hub-nav)", () => {
  assert.match(account, /id="pv-hub-nav"/);
  assert.match(account, /pv-primary-nav/);
  assert.match(account, /data-nav="home"/);
  assert.match(account, /data-nav="ai"/);
  assert.match(plat, /pv-hub-nav-ready/);
  assert.match(plat, /body\.pv-hub-nav-ready #pv-plat-fab/);
});

test("Fallback Hub FAB stays left (not right stack)", () => {
  assert.match(plat, /#pv-plat-fab \{[\s\S]*?left:\s*max\(12px/);
  assert.match(plat, /right:\s*auto/);
});

test("Hub trigger dims while magic sheet open", () => {
  assert.match(plat, /body\.pv-magic-open #pv-hub-nav/);
  assert.match(magic, /body\.pv-magic-open #pv-plat-fab/);
});

test("magic root z-index clears Hub stacking context", () => {
  assert.match(magic, /z-index:120040/);
  assert.match(ux, /z-index:120050!important/);
});

test("bacchetta still rendered by magic-extras", () => {
  assert.match(magic, /Bacchetta magica/);
  assert.match(magic, /id="pv-magic-open"/);
  assert.match(magic, /function renderFab/);
  assert.match(index, /magic-extras-20261112b\.js/);
});

test("renderFab only skips spinner, not trip-error main.loading", () => {
  assert.match(magic, /main\.loading \.spin/);
  assert.doesNotMatch(magic, /if \(document\.querySelector\("main\.loading"\)\) return/);
});

test("stamp shell wired (platform 20261110b + magic 20261107l)", () => {
  assert.match(index, /pv-platform-20261112e\.js/);
  assert.match(index, /magic-extras-20261112b\.js/);
  assert.match(index, /ux-suite-20261112d\.js/);
  assert.match(index, /expense-splitwise-20261111o\.js/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
