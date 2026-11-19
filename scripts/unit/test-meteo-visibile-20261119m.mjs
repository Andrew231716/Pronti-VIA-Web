#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else { failed += 1; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}
const magic = readFileSync("magic-extras.js", "utf8");
const dest = readFileSync("destination-theme.js", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");
const index = readFileSync("index.html", "utf8");
ok("sticker in meteo title", /titleEl\.innerHTML = `.*pv-weather-sticker/.test(magic) || /pv-block-title.*pv-weather-sticker/.test(magic));
ok("ghana contrast in dest-theme (wins cascade)", /html\[data-pv-dest="gh"\] body\.pv-account-ready/.test(dest) && /#d4c07a/.test(dest) && /background:#fff !important/.test(dest));
ok("navigate network-first", /HTML\/navigate: network-first/.test(sw) && /req\.mode === "navigate"/.test(sw));
ok("shell ver bumped for SW re-register", /const SHELL_VER = "20261119n"/.test(account) && /account\.js\?v=20261119n/.test(index));
ok("stamps", /magic-extras-20261119n\.js/.test(index) && /destination-theme-20261119n\.js/.test(index) && /20261119n-tappe/.test(sw) && existsSync("assets/magic-extras-20261119n.js") && existsSync("assets/destination-theme-20261119n.js"));
if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log("\nOK");
