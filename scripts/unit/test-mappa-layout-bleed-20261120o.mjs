import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120r.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120r",
  /magic-extras-20261120r\.js/.test(index) &&
    /20261120r-voce/.test(sw) &&
    /const SHELL_VER = "20261120r"/.test(account) &&
    existsSync("assets/magic-extras-20261120r.js")
);

ok(
  "overview preview OSM full width + leaflet parked",
  magic.includes("openstreetmap.org/export/embed.html") &&
    magic.includes("pv-overview-map") &&
    magic.includes("width:0 !important") &&
    magic.includes("grid-column:1 / -1 !important") &&
    magic.includes("grid-template-columns:1fr !important")
);

ok(
  "pushColoredMapPoints still selects focused stop",
  /async function pushColoredMapPoints\(selectedId/.test(magic) &&
    /pushColoredMapPoints\(overviewFocusStopId\)/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("mappa-layout-bleed 20261120r ok");
