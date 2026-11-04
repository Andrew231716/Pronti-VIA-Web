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
const ux = readFileSync("ux-suite.js", "utf8");

test("stamp pv-platform-20261104i wired", () => {
  assert.match(index, /pv-platform-20261104i\.js/);
});

test("enter animation is opt-in (pv-plat-entering)", () => {
  assert.match(plat, /pv-plat-entering/);
  assert.match(plat, /playPanelEnter/);
  assert.match(plat, /#pv-plat-panel\.open\.pv-plat-entering/);
});

test("tab switch reuses chrome and awaits content before swap", () => {
  assert.match(plat, /ensurePanelChrome/);
  assert.match(plat, /tabSwitch:\s*true/);
  assert.match(plat, /renderTabHtml/);
  assert.match(plat, /panelRenderSeq/);
  assert.doesNotMatch(plat, /pv-plat-body"><p class="pv-plat-muted">Caricamento/);
});

test("same-tab click is ignored", () => {
  assert.match(plat, /if \(btn\.dataset\.tab === activeTab\) return/);
});

test("Hub labels are speakable (Collaborazione / Panoramica)", () => {
  assert.match(plat, /HUB · Collaborazione|Hub · Collabora/);
  assert.match(plat, /\["dash", "Panoramica"\]/);
  assert.match(ux, /data-ux="hub"/);
  assert.match(ux, /Funzioni di gruppo \(HUB\)|Apri Hub/);
  assert.match(ux, /__pvNavHome|__pvNavTrips|__pvNavAi/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
