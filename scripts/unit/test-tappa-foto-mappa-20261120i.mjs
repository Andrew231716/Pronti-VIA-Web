import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120p.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120k",
  /magic-extras-20261120p\.js/.test(index) &&
    /places-suggest\.js\?v=20261120p/.test(index) &&
    /account\.js\?v=20261120p/.test(index) &&
    /20261120p-bleed/.test(sw) &&
    /const SHELL_VER = "20261120p"/.test(account) &&
    existsSync("assets/magic-extras-20261120p.js") &&
    /dataset\.pvReady = "20261120p"/.test(magic)
);

ok(
  "Foto URL stripped from visible notes",
  /function scrubStopFotoNotes/.test(magic) &&
    magic.includes("Foto:\\s*https?:\\/\\/\\S+") &&
    magic.includes("TripAdvisor|Maps|Wiki|Foto")
);

ok(
  "place photos reject coat of arms / flags / svg",
  /function isUsablePlacePhoto/.test(magic) &&
    magic.includes(".svg/i.test(s)") &&
    magic.includes("coa(?:") &&
    /fetchCommonsPlaceImage/.test(magic) &&
    /scorePlacePhoto/.test(magic) &&
    /isUsablePlacePhoto\(photo\)/.test(magic)
);

ok(
  "map only in Uno sguardo overview (not on stop card)",
  /ensureOverviewMap/.test(magic) &&
    /pv-overview-map/.test(magic) &&
    /openstreetmap\.org\/export\/embed\.html/.test(magic) &&
    /display:none !important/.test(magic) &&
    /pushColoredMapPoints\(\)/.test(magic)
);

ok(
  "enhance re-runs when Foto URL or bad thumb",
  /Foto:\\s\*https\?:\\\/\\\//.test(magic) &&
    /!isUsablePlacePhoto\(imgSrc\)/.test(magic) &&
    !/!card\.querySelector\("\.pv-stop-mini-map"\)/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("tappa-foto-mappa 20261120k ok");
