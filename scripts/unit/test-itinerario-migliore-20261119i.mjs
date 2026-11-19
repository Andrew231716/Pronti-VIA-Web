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
const diary = readFileSync("travel-diary.css", "utf8");
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "day strip is primary navigator (select visually hidden)",
  /day strip is the only day navigator/i.test(ux) &&
    /clip:rect\(0,0,0,0\)/.test(ux) &&
    /scrollIntoView/.test(ux)
);

ok(
  "itinerary CSS keeps horizontal day strip (no 3-col grid)",
  /data-pv-section="itinerary"\] \.day-strip/.test(diary) &&
    /display: flex !important/.test(diary) &&
    /grid-template-columns: none !important/.test(diary)
);

ok(
  "compact weather + stop cards",
  /\.pv-day-weather/.test(ux) &&
    /stop-card \.pv-stop-media/.test(ux) &&
    /width:92px/.test(ux)
);

ok(
  "no nested & itinerary block left broken",
  !/#root \.primary-panel > \[role="tabpanel"\]\[data-pv-section="itinerary"\] \{\s*& /.test(diary)
);

ok(
  "stamps",
  /ux-suite-20261119s\.js/.test(index) &&
    /magic-extras-20261119t\.js/.test(index) &&
    /travel-diary\.css\?v=20261119u-tint/.test(index) &&
    /20261119u-tint/.test(sw) &&
    existsSync("assets/ux-suite-20261119s.js") &&
    existsSync("assets/magic-extras-20261119t.js") &&
    /const STYLE_VER = "20261119s"/.test(ux) &&
    /dataset\.pvReady = "20261119t"/.test(magic)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");

