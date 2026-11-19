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
  "section import stays on trip (hash remount)",
  /stayOnTripSection\(/.test(ux) &&
    /__pvRemountTripSection/.test(ux) &&
    /Keep #trip=&key= so reload does not drop to Home/.test(ux) &&
    !/sessionStorage\.setItem\("pv-event-return-section"[\s\S]{0,120}location\.reload\(\);\s*return;/.test(ux)
);
ok(
  "import scope personal/shared for bookings",
  /name="pv-imp-scope"/.test(ux) &&
    /value="personal"/.test(ux) &&
    /personalBookingFromImport/.test(ux) &&
    /prenotazioni personali/.test(ux)
);
ok(
  "owner-only move personal↔shared",
  /isTripOwner\(/.test(ux) &&
    /Sposta in condivise/.test(ux) &&
    /Sposta in personali/.test(ux) &&
    /Solo il proprietario può spostare/.test(ux)
);
ok(
  "remount helper exported",
  /window\.__pvRemountTripSection = remountTripSection/.test(magic)
);
ok(
  "stamps",
  /ux-suite-20261119d\.js/.test(index) &&
    /magic-extras-20261119d\.js/.test(index) &&
    /20261119b/.test(sw) &&
    existsSync("assets/ux-suite-20261119d.js") &&
    existsSync("assets/magic-extras-20261119d.js") &&
    /const STYLE_VER = "20261119d"/.test(ux)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
