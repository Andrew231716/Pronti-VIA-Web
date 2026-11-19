#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
let failed = 0;
function ok(n, c, d = "") {
  if (c) console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  else {
    failed++;
    console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
  }
}
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
ok("time input + pill sync", /data-pv-time/.test(magic) && /normalizeStopTime/.test(magic) && /syncStopTimePill/.test(magic));
ok("single time pill (no duplicates)", /Keep a single display pill/.test(magic) && /pills\.slice\(1\)\.forEach/.test(magic));
ok("sposta-al day control", /pv-stop-move/.test(magic) && /Sposta al/.test(magic) && !/Giorno della tappa/.test(magic));
ok("no redundant Prima/Dopo extras", /drop the redundant Prima\/Dopo row/.test(magic) && !/↑ Prima/.test(magic));
ok("sort by time kept", /sortDayStopsByTime/.test(magic) && /Ordina per orario/.test(magic));
ok(
  "stamps",
  /magic-extras-20261119t\.js/.test(index) &&
    /20261119u-tint/.test(sw) &&
    existsSync("assets/magic-extras-20261119t.js") &&
    /dataset\.pvReady = "20261119t"/.test(magic)
);
if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
