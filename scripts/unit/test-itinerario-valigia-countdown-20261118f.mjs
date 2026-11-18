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

const magic = readFileSync("magic-extras.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const app = readFileSync("app-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "packing templates have sections",
  /PACKING_TEMPLATES/.test(magic) &&
    /section: "Abbigliamento"/.test(magic) &&
    /section: "Documenti"/.test(magic)
);
ok(
  "Mare template remounts Valigia without losing trip",
  (() => {
    const m = magic.match(/async function applyPackingTemplate\([\s\S]*?\n  async function |async function applyPackingTemplate\([\s\S]*?\n  function /);
    const body = m ? m[0] : "";
    return (
      /softRefreshTrip\(/.test(body) &&
      /remountTripSection\(auth,\s*"packing"\)/.test(body) &&
      /function remountTripSection\(/.test(magic) &&
      /pv-event-return-section/.test(magic)
    );
  })()
);
ok("soft refresh helper", /function softRefreshTrip\(/.test(magic) && /pv-trip-loaded/.test(magic));
ok("remount helper", /function remountTripSection\(/.test(magic) && /location\.reload\(\)/.test(magic));
ok(
  "cover countdown",
  /function injectCoverCountdown\(/.test(magic) &&
    /pv-cover-countdown/.test(magic) &&
    /Tra \$\{days\} giorni/.test(magic)
);
ok("countdown on tick", /injectCoverCountdown\(\)/.test(magic));
ok(
  "packing category filters",
  /pv-pack-cats/.test(ux) &&
    /data-pvPackSection|dataset\.pvPackSection/.test(ux) &&
    /Categorie valigia/.test(ux)
);
ok(
  "itinerary order polish",
  /data-pv-section="itinerary"/.test(ux) &&
    /order:-30/.test(ux) &&
    /#root \.primary-panel > \[role="tabpanel"\]\[data-pv-section="itinerary"\]/.test(diary)
);
ok("smoother panel animation", /animation: pv-panel-in \.18s/.test(diary) && /from \{ opacity: \.72; \}/.test(diary));
ok("tick debounce softened", /}, 480\);/.test(ux) && /setTimeout\(tick, 380\)/.test(app));
ok(
  "stamps",
  /magic-extras-20261118h\.js/.test(index) &&
    /ux-suite-20261118h\.js/.test(index) &&
    /app-suite-20261118h\.js/.test(index) &&
    /travel-diary\.css\?v=20261118h/.test(index) &&
    /20261118h/.test(sw)
);
ok(
  "assets",
  existsSync("assets/magic-extras-20261118h.js") &&
    existsSync("assets/ux-suite-20261118h.js") &&
    existsSync("assets/app-suite-20261118h.js") &&
    readFileSync("assets/magic-extras-20261118h.js", "utf8").includes('dataset.pvReady = "20261118h"') &&
    readFileSync("assets/ux-suite-20261118h.js", "utf8").includes('const STYLE_VER = "20261118h"')
);
ok(
  "cover countdown clear of title",
  /#root \.pv-cover-countdown[\s\S]*?top:\s*\.75rem/.test(diary) &&
    /#root \.pv-cover-countdown \.pv-cover-count-meta\s*\{\s*display:\s*none/.test(diary)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
