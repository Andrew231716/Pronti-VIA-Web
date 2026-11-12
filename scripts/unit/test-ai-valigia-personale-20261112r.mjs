#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const shim = readFileSync("api-shim.js", "utf8");
const magic = readFileSync("magic-extras.js", "utf8");
const app = readFileSync("app-suite.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("private packing key", /viavia-private-packing-v1/.test(shim));
ok("apply + take packing private", /applyPrivatePackingView/.test(shim) && /takePackingPrivate/.test(shim));
ok("shared checklist cleared on write", /next\.checklist = \[\]/.test(shim));
ok("AI pack block", /pv-pack/.test(magic) && /parseAiPackBlock/.test(magic));
ok("AI actions block", /pv-actions/.test(magic) && /parseAiActionBlock/.test(magic));
ok("destination packing suggestions", /packingSuggestionsForDestination/.test(magic));
ok("add packing + note helpers", /async function addPackingItems/.test(magic) && /appendTripNote/.test(magic));
ok("direct commands", /tryDirectSectionCommands/.test(magic) && /alla valigia/.test(magic));
ok("valigia chip", /data-q="Cosa mettere in valigia/.test(magic));
ok("privacy banner", /Valigia personale/.test(magic) && /pv-pack-privacy/.test(magic));
ok("app-suite personal packing", /Valigia personale/.test(app) && /data-pronty/.test(app));
ok("ux checklist note", /personali/.test(ux));
ok(
  "stamps wired",
  /api-shim-20261112r\.js/.test(index) &&
    /magic-extras-20261112r\.js/.test(index) &&
    /app-suite-20261112r\.js/.test(index) &&
    /ux-suite-20261112r\.js/.test(index)
);
ok(
  "sw + assets",
  /20261112r/.test(sw) &&
    existsSync("assets/api-shim-20261112r.js") &&
    existsSync("assets/magic-extras-20261112r.js") &&
    existsSync("assets/app-suite-20261112r.js") &&
    existsSync("assets/ux-suite-20261112r.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
