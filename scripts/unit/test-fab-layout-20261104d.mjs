#!/usr/bin/env node
/**
 * Post-merge FAB layout: Hub must not cover bacchetta magica.
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
const index = readFileSync("index.html", "utf8");

test("Hub FAB anchored to the left (not right stack)", () => {
  assert.match(plat, /#pv-plat-fab \{[\s\S]*?left:\s*max\(12px/);
  assert.match(plat, /right:\s*auto/);
  assert.doesNotMatch(
    plat.replace(/@media[\s\S]*?#pv-plat-fab[\s\S]*?}/, ""),
    /#pv-plat-fab \{[\s\S]*?right:\s*max\(12px/
  );
});

test("Hub hides while magic sheet open", () => {
  assert.match(plat, /body\.pv-magic-open #pv-plat-fab/);
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
  assert.match(index, /magic-extras-20261104d\.js/);
});

test("renderFab only skips spinner, not trip-error main.loading", () => {
  assert.match(magic, /main\.loading \.spin/);
  assert.doesNotMatch(magic, /if \(document\.querySelector\("main\.loading"\)\) return/);
});

test("stamp 20261104d wired in shell", () => {
  assert.match(index, /pv-platform-20261104d\.js/);
  assert.match(index, /20261104d/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
