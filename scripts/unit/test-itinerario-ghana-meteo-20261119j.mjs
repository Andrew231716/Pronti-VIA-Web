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
const dest = readFileSync("destination-theme.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "meteo shows without day click gate",
  /ensureWeatherSkeleton/.test(magic) &&
    /Show meteo as soon as the day strip exists/.test(magic) &&
    !/Only show weather after the user selects a day/.test(magic)
);

ok(
  "Ghana stickers include scrapbook emoji set",
  /id: "gh"/.test(dest) &&
    /stickers: \["⭐", "🥁", "🌴", "☀️", "🐘", "🏖️"\]/.test(dest)
);

ok(
  "section stickers injected for dest themes",
  /ensureSectionStickers/.test(dest) &&
    /pv-section-stickers/.test(dest) &&
    /__pvRefreshSectionStickers/.test(dest) &&
    /__pvRefreshSectionStickers/.test(ux)
);

ok(
  "Ghana panel chrome light + dark",
  /html\[data-pv-dest="gh"\]/.test(diary) &&
    /html\[data-pv-theme="dark"\]\[data-pv-dest="gh"\]/.test(diary) &&
    /border-block-start: 3px solid var\(--pv-dest-accent/.test(diary) &&
    /pv-day-weather/.test(diary)
);

ok(
  "stamps",
  /destination-theme-20261119p\.js/.test(index) &&
    /ux-suite-20261119o\.js/.test(index) &&
    /magic-extras-20261119o\.js/.test(index) &&
    /travel-diary\.css\?v=20261119p-contrasto/.test(index) &&
    /20261119p-contrasto/.test(sw) &&
    existsSync("assets/destination-theme-20261119p.js") &&
    existsSync("assets/ux-suite-20261119o.js") &&
    existsSync("assets/magic-extras-20261119o.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
