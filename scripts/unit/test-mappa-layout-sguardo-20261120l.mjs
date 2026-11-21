import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120o.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120o",
  /magic-extras-20261120o\.js/.test(index) &&
    /20261120o-bleed/.test(sw) &&
    /const SHELL_VER = "20261120o"/.test(account) &&
    existsSync("assets/magic-extras-20261120o.js")
);

ok(
  "overview map is full-bleed Leaflet with caption",
  magic.includes('.map-card .pv-overview-map{display:none !important}') &&
    magic.includes("width:100% !important") &&
    magic.includes("grid-column:1 / -1") &&
    magic.includes("data-pv-open-map") &&
    magic.includes("Apri mappa") &&
    magic.includes("#root .map-card > .map-caption")
);

ok(
  "prep gaps still present after layout rebase",
  /function collectPrepGaps/.test(magic) &&
    /Ancora da preparare/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("mappa-layout-sguardo 20261120o ok");
