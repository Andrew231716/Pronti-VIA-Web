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
const mapHtml = readFileSync("map.html", "utf8");

ok(
  "stamps 20261120o",
  /magic-extras-20261120o\.js/.test(index) &&
    /20261120o-bleed/.test(sw) &&
    /const SHELL_VER = "20261120o"/.test(account) &&
    existsSync("assets/magic-extras-20261120o.js") &&
    /dataset\.pvReady = "20261120o"/.test(magic)
);

ok(
  "overview uses Leaflet full-bleed, not OSM embed",
  magic.includes('.map-card .pv-overview-map{display:none !important}') &&
    magic.includes("host.querySelectorAll(\".pv-overview-map\")") &&
    magic.includes("width:100% !important") &&
    magic.includes("max-width:none !important") &&
    magic.includes("grid-column:1 / -1") &&
    /map\.html\?v=20261120o/.test(magic)
);

ok(
  "map.html resizes and zooms focused stop",
  mapHtml.includes("viavia-map-resize") &&
    mapHtml.includes("pts.length === 1") &&
    mapHtml.includes("map.setView")
);

ok(
  "pushColoredMapPoints selects focused stop",
  /async function pushColoredMapPoints\(selectedId/.test(magic) &&
    /pushColoredMapPoints\(overviewFocusStopId\)/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("mappa-layout-bleed 20261120o ok");
