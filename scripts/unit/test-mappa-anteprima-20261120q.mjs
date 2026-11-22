import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120s.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120s",
  /magic-extras-20261120s\.js/.test(index) &&
    /20261120s-piano/.test(sw) &&
    /const SHELL_VER = "20261120s"/.test(account) &&
    existsSync("assets/magic-extras-20261120s.js") &&
    /dataset\.pvReady = "20261120s"/.test(magic)
);

ok(
  "visible preview is OSM embed, Leaflet parked",
  magic.includes("openstreetmap.org/export/embed.html") &&
    magic.includes("pv-overview-map") &&
    magic.includes("Park SPA Leaflet") &&
    magic.includes("position:absolute !important") &&
    magic.includes("width:0 !important") &&
    magic.includes("height:calc(100% + 58px)")
);

ok(
  "overview map fills card without white strip",
  magic.includes("#root .map-card .pv-overview-map") &&
    magic.includes("width:100% !important") &&
    magic.includes("left:0 !important") &&
    magic.includes("right:0 !important") &&
    magic.includes("grid-column:1 / -1 !important")
);

if (process.exitCode) process.exit(1);
console.log("mappa-anteprima 20261120s ok");
