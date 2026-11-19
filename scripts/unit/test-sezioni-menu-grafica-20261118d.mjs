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
const stamped = readFileSync("assets/ux-suite-20261119d.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

const iconKeys = [
  "itinerary",
  "explore",
  "places",
  "preventivo",
  "bookings",
  "spese",
  "docs",
  "packing",
  "notes",
];

ok(
  "every trip tab has an icon meta",
  /icon: "itinerary"/.test(ux) &&
    /icon: "explore"/.test(ux) &&
    /icon: "places"/.test(ux) &&
    /icon: "preventivo"/.test(ux) &&
    /icon: "bookings"/.test(ux) &&
    /icon: "spese"/.test(ux) &&
    /icon: "docs"/.test(ux) &&
    /icon: "packing"/.test(ux) &&
    /icon: "notes"/.test(ux)
);
ok(
  "ICON_SVG covers all section icons",
  iconKeys.every((key) => new RegExp(`${key}:\\s*'<svg`).test(ux))
);
ok("decorate section heading", /function decorateSectionHeading\(/.test(ux) && /pv-section-icon/.test(ux));
ok("section panel data attr", /dataset\.pvSection/.test(ux));
ok("guide accent style", /border-inline-start:3px solid/.test(ux));
ok(
  "diary section panel polish",
  /data-pv-section/.test(diary) &&
    /#root \.primary-panel \.day-strip > button/.test(diary) &&
    /#root \.primary-panel \.check-row/.test(diary) &&
    /#root \.primary-panel \.money-stats/.test(diary) &&
    /#root \.primary-panel \.notes-paper/.test(diary)
);
ok("toolbar not forced full-width share", /min-width: 8\.5rem/.test(diary));
ok(
  "stamps wired",
  /ux-suite-20261119d\.js/.test(index) &&
    /travel-diary\.css\?v=20261118h/.test(index) &&
    /ux-suite-20261119d\.js/.test(sw) &&
    /20261118h/.test(sw)
);
ok(
  "asset mirrors source",
  existsSync("assets/ux-suite-20261119d.js") &&
    stamped.includes('const STYLE_VER = "20261119d"') &&
    stamped.includes("decorateSectionHeading")
);
ok("style ver bumped", /const STYLE_VER = "20261119d"/.test(ux));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
