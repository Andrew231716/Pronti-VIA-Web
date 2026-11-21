import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120l.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120l",
  /magic-extras-20261120l\.js/.test(index) &&
    /20261120l-layout/.test(sw) &&
    /const SHELL_VER = "20261120l"/.test(account) &&
    existsSync("assets/magic-extras-20261120l.js")
);

ok(
  "overview map crops OSM chrome and tightens caption",
  magic.includes("height:calc(100% + 52px)") &&
    magic.includes("margin:0 0 -52px") &&
    magic.includes("pv-overview-map::after") &&
    magic.includes("data-pv-open-map") &&
    magic.includes("Apri mappa") &&
    magic.includes(".map-card > .map-caption")
);

if (process.exitCode) process.exit(1);
console.log("mappa-layout-sguardo 20261120l ok");
