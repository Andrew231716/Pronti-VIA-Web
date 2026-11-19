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
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("itinerary phase is both", /itinerary:\s*\{\s*phase:\s*"both"/.test(ux));
ok("prep hint mentions itinerario", /Itinerario giorno per giorno/.test(ux));
ok("prep tab order leads with itinerary", /\["itinerary", "preventivo", "bookings", "documents", "packing"/.test(ux));
ok("prep preferred tab includes itinerary first", /phase === "trip"[\s\S]*?:\s*\["itinerary", "preventivo"/.test(ux));
ok(
  "stayOnTripSection keeps phase for both tabs",
  /Only force phase for prep-only/.test(ux) &&
    /section === "expenses" \|\| section === "notes"/.test(ux)
);
ok("section guide covers planning", /Organizza i giorni/.test(ux));
ok("style ver 20261119j", /const STYLE_VER = "20261119o"/.test(ux));
ok("stamps wired", /ux-suite-20261119o\.js/.test(index) && /ux-suite-20261119o\.js/.test(sw));
ok(
  "asset mirrors source",
  existsSync("assets/ux-suite-20261119o.js") &&
    readFileSync("assets/ux-suite-20261119o.js", "utf8") === ux
);
ok("documenti preview still present", /function openTripDocumentPreview/.test(ux));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
