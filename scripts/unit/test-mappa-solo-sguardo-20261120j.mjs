import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120j.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120j",
  /magic-extras-20261120j\.js/.test(index) &&
    /20261120j-sguardo/.test(sw) &&
    /const SHELL_VER = "20261120j"/.test(account) &&
    existsSync("assets/magic-extras-20261120j.js")
);

ok(
  "no mini-map on stop cards",
  /display:none !important/.test(magic) &&
    /Map belongs only in/.test(magic) &&
    !/Mappa tappa/.test(magic) &&
    !/hasMapLink && !card\.querySelector\("\.pv-stop-mini-map"\)/.test(magic)
);

ok(
  "overview map in Uno sguardo alla mappa",
  /async function ensureOverviewMap/.test(magic) &&
    /pv-overview-map/.test(magic) &&
    /Uno sguardo alla mappa/.test(magic) &&
    /osmEmbedSrc/.test(magic) &&
    /void ensureOverviewMap\(\)/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("mappa-solo-sguardo 20261120j ok");
