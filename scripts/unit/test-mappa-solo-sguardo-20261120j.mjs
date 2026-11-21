import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120q.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120k",
  /magic-extras-20261120q\.js/.test(index) &&
    /20261120q-preview/.test(sw) &&
    /const SHELL_VER = "20261120q"/.test(account) &&
    existsSync("assets/magic-extras-20261120q.js")
);

ok(
  "no mini-map on any stop card",
  /display:none !important/.test(magic) &&
    /Map belongs only in/.test(magic) &&
    /stripStopMiniMaps/.test(magic)
);

ok(
  "overview map for every geocoded stop",
  /async function ensureOverviewMap/.test(magic) &&
    /bindOverviewMapLinks/.test(magic) &&
    /resolveOverviewFocusStop/.test(magic) &&
    /tappe in mappa/.test(magic) &&
    /Vedi sulla mappa/.test(magic) &&
    /for \(const stop of needsCoords\)/.test(magic) &&
    !/needsCoords\.slice\(0, 8\)/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("mappa-solo-sguardo 20261120k ok");
