#!/usr/bin/env node
/**
 * Hub panel: tab switches must not re-run enter animation / collapse height.
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
const index = readFileSync("index.html", "utf8");

test("stamp pv-platform-20261104f wired", () => {
  assert.match(index, /pv-platform-20261104f\.js/);
});

test("enter animation is opt-in (not default open pose)", () => {
  assert.match(plat, /pv-plat-entering/);
  assert.match(plat, /playPanelEnter/);
  // Default panel pose is resting (no translateY offset without entering class).
  assert.match(plat, /\/\* Resting open pose/);
  assert.doesNotMatch(
    plat.replace(/#pv-plat-panel\.open\.pv-plat-entering[\s\S]*?}/, ""),
    /#pv-plat-panel \{[\s\S]*?transform:\s*translateY\(12px\)/
  );
});

test("tab switch reuses chrome and awaits content before swap", () => {
  assert.match(plat, /ensurePanelChrome/);
  assert.match(plat, /tabSwitch:\s*true/);
  assert.match(plat, /renderTabHtml/);
  assert.match(plat, /panelRenderSeq/);
  // Must not flash empty "Caricamento…" body on every tab click.
  assert.doesNotMatch(plat, /pv-plat-body"><p class="pv-plat-muted">Caricamento/);
});

test("same-tab click is ignored", () => {
  assert.match(plat, /if \(btn\.dataset\.tab === activeTab\) return/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
