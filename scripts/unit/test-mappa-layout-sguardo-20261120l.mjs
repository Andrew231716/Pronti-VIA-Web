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
    /20261120t-assicura/.test(sw) &&
    /const SHELL_VER = "20261120t"/.test(account) &&
    existsSync("assets/magic-extras-20261120s.js")
);

ok(
  "overview map shows OSM preview with caption",
  magic.includes("pv-overview-map") &&
    magic.includes("openstreetmap.org/export/embed.html") &&
    magic.includes("data-pv-open-map") &&
    magic.includes("Apri mappa") &&
    magic.includes("#root .map-card > .map-caption") &&
    magic.includes("height:calc(100% + 58px)")
);

ok(
  "prep gaps still present after layout rebase",
  /function collectPrepGaps/.test(magic) &&
    /Ancora da preparare/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("mappa-layout-sguardo 20261120s ok");
