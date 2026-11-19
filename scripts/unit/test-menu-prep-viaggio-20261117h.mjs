#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ux = readFileSync("ux-suite.js", "utf8");
const stamped = readFileSync("assets/ux-suite-20261119z.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("phase key + meta", /TRIP_PHASE_KEY/.test(ux) && /TRIP_TAB_META/.test(ux));
ok("enhanceTripModeNav wired", /function enhanceTripModeNav\(/.test(ux) && /run\(enhanceTripModeNav\)/.test(ux));
ok("prep vs trip copy", /Prepara/.test(ux) && /In viaggio/.test(ux));
ok("Spese short label + distinct icon", /label: "Spese"/.test(ux) && /icon: "spese"/.test(ux) && /ICON_SVG/.test(ux));
ok("Documenti file icon", /icon: "docs"/.test(ux));
ok("section guides", /SECTION_GUIDE/.test(ux) && /pv-section-guide/.test(ux));
ok("toolbar companions open share", /polishTripToolbar/.test(ux) && /Compagni di viaggio/.test(ux));
ok("hide phase tabs css", /data-pv-trip-phase="prep"/.test(ux) && /data-pv-phase="trip"/.test(ux));
ok("diary mobile tab stack", /flex-direction: column !important/.test(diary));
ok("diary toolbar polish", /#root \.trip-toolbar/.test(diary) && /pv-trip-phase/.test(diary));
ok(
  "stamps wired",
  /ux-suite-20261119z\.js/.test(index) &&
    /travel-diary\.css\?v=20261119z-iafile/.test(index) &&
    /ux-suite-20261119z\.js/.test(sw) &&
    /20261119z-iafile/.test(sw)
);
ok("asset mirrors source", existsSync("assets/ux-suite-20261119z.js") && stamped.includes('const STYLE_VER = "20261119z"'));
ok("style ver bumped", /const STYLE_VER = "20261119z"/.test(ux));
ok("harness exists", existsSync("scripts/unit/harness-menu-prep.html"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
