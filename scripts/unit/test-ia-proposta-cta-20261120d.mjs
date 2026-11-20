#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

const ok = (name, cond) => {
  if (!cond) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
};

const magic = readFileSync("magic-extras.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "activity schedule → itinerary stops",
  /function looksLikeActivitySchedule/.test(ux) &&
    /attivit\|activity\|agenda\|schedule/.test(ux) &&
    /elenco attività → Itinerario/.test(ux) &&
    /Programma · \$\{sourceName/.test(ux)
);

ok(
  "sticky footer Invia alle sezioni",
  /function syncChatImportFooter/.test(magic) &&
    /data-chat-imp-apply>Invia alle sezioni/.test(magic) &&
    /pv-actions \[data-chat-imp-apply\]/.test(magic) &&
    /pv-chat-import-actions\{display:none\}/.test(magic)
);

ok(
  "clarify chips above list + AI prefers stop for hub",
  /Correzioni rapide[\s\S]*\$\{html\}/.test(magic) &&
    /JW Hub \/ congresso → kind "stop"/.test(magic)
);

ok(
  "stamps 20261120e",
  /magic-extras-20261120e\.js/.test(index) &&
    /ux-suite-20261120d\.js/.test(index) &&
    /20261120f-tappa/.test(sw) &&
    /const SHELL_VER = "20261120f"/.test(account) &&
    existsSync("assets/magic-extras-20261120e.js") &&
    existsSync("assets/ux-suite-20261120d.js") &&
    /dataset\.pvReady = "20261120e"/.test(magic) &&
    /const STYLE_VER = "20261120d"/.test(ux)
);

if (process.exitCode) process.exit(process.exitCode);
console.log("all ok");
