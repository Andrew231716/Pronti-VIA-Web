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

const prev = readFileSync("preventivo-islanda.js", "utf8");
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("parse table helper", /function parsePreventivoTableText/.test(prev));
ok("file reader", /async function readPreventivoImportFile/.test(prev));
ok("image vision path", /extractPreventivoFromImage/.test(prev) && /image_url/.test(prev));
ok("xlsx/docx/pdf paths", /extractSheetMatrix/.test(prev) && /extractTextFromDocx/.test(prev) && /extractTextFromPdf/.test(prev));
ok("import wizard UI", /openPreventivoImportWizard/.test(prev) && /Importa foglio \/ PDF \/ foto/.test(prev));
ok("window export", /__pvOpenPreventivoImport/.test(prev) && /__pvParsePreventivoImport/.test(prev));
ok("trip section import button", /pv-tp-import/.test(magic));
ok(
  "stamps",
  /preventivo-islanda-20261117a\.js/.test(index) &&
    /magic-extras-20261119k\.js/.test(index) &&
    existsSync("assets/preventivo-islanda-20261117a.js") &&
    existsSync("assets/magic-extras-20261119k.js")
);
ok("sw cache", /20261117a/.test(sw) && /preventivo-islanda-20261117a\.js/.test(sw));

// Runtime parse of the user's sheet shape
const start = prev.indexOf("function guessPreventivoKey");
const end = prev.indexOf("function loadScriptOnce");
const chunk = prev.slice(start, end);
const factory = new Function(`
  const uid = () => "id-" + Math.random().toString(36).slice(2);
  const nowIso = () => "2026-11-17T00:00:00.000Z";
  const fmtMoney = (c) => "€" + ((Number(c)||0)/100).toFixed(2);
  ${chunk}
  return { parsePreventivoTableText };
`);
const { parsePreventivoTableText } = factory();
const sample = `tipologia\tcosto\tcosto\tnote\tconfermati
Alloggio\t€915,00\t€915,00\tInclusa tassa rubi\t✓
Volo\t€987,00\t€987,00\t\t✓
Alloggio istanbul\tx\tx\t\t-
vaccini\t€50,00\t€50,00\tsolo 1 obbligatorio\t-
Assicurazione\t€70,00\t€70,00\t\t-
internet\t€60,00\t€10,00\tdati illimitati\t-
Cibo\t\t\t\t-
Attività betel\t€275,00\t€275,00\tse le facciamo tutte\t-
parchi\t€80,00\t€80,00\t\t-
passaporto\t€120,00\tx\t\t-
Visto\t€230,00\t€230,00\t\t-
Totale\t€2.787,00\t€2.617,00\t\t`;
const lines = parsePreventivoTableText(sample, { sourceName: "sheet" });
ok("parses sample rows", lines.length >= 8, String(lines.length));
ok(
  "Alloggio verified 915",
  lines.some((l) => l.title === "Alloggio" && l.unitCents === 91500 && l.status === "VERIFICATO")
);
ok("skips Totale", !lines.some((l) => /^totale$/i.test(l.title)));
ok("skips x/x istanbul", !lines.some((l) => /istanbul/i.test(l.title)));
ok(
  "internet keeps alt note",
  lines.some((l) => l.title === "internet" && l.unitCents === 6000 && /Costo alt/i.test(l.source || ""))
);
ok(
  "passaporto 120 despite alt x",
  lines.some((l) => l.title === "passaporto" && l.unitCents === 12000)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
