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
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("packing topic helper", /function isPackingQuestion/.test(magic) && /lastChatTopic === "packing"/.test(magic));
ok("follow-up altri stays packing", /ne chied\[oi\] altri|altri suggeriment/.test(magic));
ok("packing clears places", /if \(packingAsk\) \{\s*aiPlaces = \[\]/.test(magic));
ok("needPlaces gated", /needPlaces = !packingAsk &&/.test(magic));
ok("no stop acts on packing", /const stopActs = packingAsk/.test(magic));
ok("prompt forbids places on packing", /Domanda valigia ⇒ zero itinerario/.test(magic));
ok("exclude already suggested", /suggestedPackTitles/.test(magic) && /exclude: \[\.\.\.suggestedPackTitles\]/.test(magic));
ok(
  "stamp magic 20261113a",
  /magic-extras-20261113a\.js/.test(index) &&
    /magic-extras-20261113a\.js/.test(sw) &&
    existsSync("assets/magic-extras-20261113a.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
