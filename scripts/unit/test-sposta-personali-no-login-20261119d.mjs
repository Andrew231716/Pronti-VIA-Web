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
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "shared→personal uses in-place refresh (no reload)",
  /refreshBookingsAfterScopeMove/.test(ux) &&
    /Spostata tra le prenotazioni personali/.test(ux) &&
    /Stay in-trip: no full reload/.test(ux)
);

ok(
  "remount preserves pending share + replaceState",
  /pv-pending-share-v1/.test(magic) &&
    /history\.replaceState\(null, "", url\)/.test(magic) &&
    /history\.replaceState\(null, "", url\)/.test(ux)
);

ok(
  "move uses live tripAuth credentials",
  /const active = tripAuth\(\)/.test(ux) &&
    /loadTripByAuth\(active\)/.test(ux) &&
    /stopPropagation/.test(ux)
);

ok(
  "stamps",
  /ux-suite-20261119f\.js/.test(index) &&
    /magic-extras-20261119d\.js/.test(index) &&
    /ux-suite-20261119f\.js/.test(sw) &&
    /magic-extras-20261119d\.js/.test(sw) &&
    existsSync("assets/ux-suite-20261119f.js") &&
    existsSync("assets/magic-extras-20261119d.js") &&
    /const STYLE_VER = "20261119f"/.test(ux) &&
    /dataset\.pvReady = "20261119d"/.test(magic)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
