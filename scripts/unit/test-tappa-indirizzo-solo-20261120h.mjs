import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const places = readFileSync("places-suggest.js", "utf8");
const magic = readFileSync("assets/magic-extras-20261120m.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120k",
  /magic-extras-20261120k\.js/.test(index) &&
    /places-suggest\.js\?v=20261120k/.test(index) &&
    /20261120m-prep/.test(sw) &&
    /const SHELL_VER = "20261120m"/.test(account) &&
    existsSync("assets/magic-extras-20261120m.js")
);

ok(
  "places search only on Indirizzo o località (not titolo luogo)",
  /Indirizzo o località/.test(places) &&
    /never the stop title/.test(places) &&
    !/indirizzo\|localit\[aà\]\|luogo/i.test(places) &&
    /fieldLabelText\(input\) === "Indirizzo o località"/.test(places)
);

ok(
  "geocode uses address only, never title fallback",
  /String\(stop\.address \|\| ""\)\.trim\(\)\.length >= 2/.test(magic) &&
    !/stop\.address \|\| stop\.title/.test(magic.slice(magic.indexOf("needsCoords"), magic.indexOf("needsCoords") + 500))
);

ok(
  "stop image fetched from address and map-empty re-enhances",
  /fetchStopPlaceImage/.test(magic) &&
    /upsertFotoNote/.test(magic) &&
    /map-card \.map-empty/.test(magic) &&
    /dataset\.pvAddr/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("tappa-indirizzo-solo 20261120k ok");
