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

const account = readFileSync("account.js", "utf8");
const shim = readFileSync("api-shim.js", "utf8");
const sw = readFileSync("sw.js", "utf8");
const map = readFileSync("map.html", "utf8");
const index = readFileSync("index.html", "utf8");

ok(
  "pvacct offline boots from local trips",
  /navigator\.onLine === false/.test(account) &&
    /readLocalTrips\(\)/.test(account) &&
    !/activateSession\(\{ \.\.\.session, trips: \[\] \}\)/.test(account)
);
ok(
  "api timeout for account calls",
  /AbortSignal\.timeout/.test(account) && /timeoutMs/.test(account)
);
ok(
  "loadApp no cache-bust offline",
  /Never cache-bust offline/.test(account) &&
    /force && online \? `\$\{APP_MODULE\}\?t=\$\{Date\.now\(\)\}` : APP_MODULE/.test(account)
);
ok(
  "offline trips prefer local immediately",
  /Offline: serve \/ mutate the on-device trip copy/.test(shim) &&
    /!navigator\.onLine/.test(shim)
);
ok(
  "SW cache-first shell + resilient precache",
  /precacheAll/.test(sw) &&
    /preferCache/.test(sw) &&
    /NETWORK_MS/.test(sw) &&
    /20261119s-riquadro/.test(sw)
);
ok(
  "SW precaches pdfjs + leaflet images",
  /event-pdf\.mjs/.test(sw) &&
    /pdf\.min\.mjs/.test(sw) &&
    /marker-icon\.png/.test(sw)
);
ok(
  "map offline message",
  /Mappa non disponibile offline/.test(map) &&
    /navigator\.onLine === false/.test(map)
);
ok(
  "stamps wired",
  /account.js\?v=20261119t/.test(index) &&
    /api-shim-20261119f\.js/.test(index) &&
    existsSync("assets/api-shim-20261119f.js") &&
    /const SHELL_VER = "20261119t"/.test(account)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
