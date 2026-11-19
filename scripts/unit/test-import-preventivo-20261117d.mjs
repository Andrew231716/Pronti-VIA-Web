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
ok("OCR spreadsheet parser", /function parseSpreadsheetOcrText/.test(prev) && /__pvParsePreventivoOcr/.test(prev));
ok("file reader", /async function readPreventivoImportFile/.test(prev));
ok(
  "image OCR path (no broken Pollinations vision)",
  /extractPreventivoFromImage/.test(prev) &&
    /tesseract\.js@5/.test(prev) &&
    /createWorker/.test(prev) &&
    /tessedit_pageseg_mode/.test(prev) &&
    /prepareImageBlobForOcr/.test(prev) &&
    !/image_url/.test(prev) &&
    !/text\.pollinations\.ai\/openai/.test(prev.slice(prev.indexOf("extractPreventivoFromImage")))
);
ok("xlsx/docx/pdf paths", /extractSheetMatrix/.test(prev) && /extractTextFromDocx/.test(prev) && /extractTextFromPdf/.test(prev));
ok("import wizard UI", /openPreventivoImportWizard/.test(prev) && /Importa nel Preventivo/.test(prev) && /Importa foglio/.test(prev));
ok("window export", /__pvOpenPreventivoImport/.test(prev) && /__pvParsePreventivoImport/.test(prev));
ok("trip section import button", /pv-tp-import/.test(magic));
ok(
  "import mounts on body (survives render)",
  /document\.body\.appendChild\(host\)/.test(prev) &&
    /ensureImportWizardHost/.test(prev) &&
    /position:fixed/.test(prev) &&
    /z-index:130050/.test(prev) &&
    /Legacy mounts lived inside/.test(prev)
);
ok("open after hydrate/render", /async function openPreventivoImportWizard/.test(prev) && /await openPreventivo\(\)/.test(prev));
ok("per-file errors isolated", /fileErrors\.push/.test(prev) && /File saltati/.test(prev));
ok(
  "stamps",
  /preventivo-islanda-20261117e\.js/.test(index) &&
    /magic-extras-20261120a\.js/.test(index) &&
    existsSync("assets/preventivo-islanda-20261117e.js") &&
    existsSync("assets/magic-extras-20261120a.js")
);
ok("sw cache", /20261118h/.test(sw) && /preventivo-islanda-20261117e\.js/.test(sw));
// Runtime parse of the user's sheet shape
const start = prev.indexOf("function guessPreventivoKey");
const end = prev.indexOf("function loadScriptOnce");
const chunk = prev.slice(start, end);
const factory = new Function(`
  const uid = () => "id-" + Math.random().toString(36).slice(2);
  const nowIso = () => "2026-11-17T00:00:00.000Z";
  const fmtMoney = (c) => "€" + ((Number(c)||0)/100).toFixed(2);
  ${chunk}
  return { parsePreventivoTableText, parseSpreadsheetOcrText };
`);
const { parsePreventivoTableText, parseSpreadsheetOcrText } = factory();
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
ok("skips Totale", !lines.some((l) => /totale/i.test(l.title)));
ok("skips x/x istanbul", !lines.some((l) => /istanbul/i.test(l.title)));
ok(
  "internet keeps alt note",
  lines.some((l) => l.title === "internet" && l.unitCents === 6000 && /Costo alt/i.test(l.source || ""))
);
ok(
  "passaporto 120 despite alt x",
  lines.some((l) => l.title === "passaporto" && l.unitCents === 12000)
);

// OCR text shaped like a Sheets screenshot of the user's foglio
const ocrLike = `tipologia costo costo note confermati
Alloggio €915,00 €915,00 Inclusa tassa rubi
Volo €987,00 €987,00
Alloggio istanbul x x
vaccini €50,00 €50,00 solo 1 obbligatorio
Assicurazione €70,00 €70,00 -
dati illimitati per 15 giorni (la può prendere
solo 1 che fa da hotspot per gli altri per
internet €60,00 €10,00 dividere il costo)
Cibo
Attività betel €275,00 €275,00 se le facciamo tutte
parchi €80,00 €80,00
passaporto €120,00 x
Visto €230,00 €230,00
Totale €2.787,00 €2.617,00`;
const ocrLines = parseSpreadsheetOcrText(ocrLike, { sourceName: "foto" });
ok("OCR sheet row count", ocrLines.length === 9, String(ocrLines.length));
ok(
  "OCR does not invent note-as-cost rows",
  !ocrLines.some((l) => /dati illimitati|^solo$/i.test(l.title))
);
ok(
  "OCR Alloggio 915",
  ocrLines.some((l) => l.title === "Alloggio" && l.unitCents === 91500)
);
ok(
  "OCR internet 60 with alt 10 and wrapped note",
  ocrLines.some(
    (l) =>
      l.title === "internet" &&
      l.unitCents === 6000 &&
      /Costo alt: €10\.00/.test(l.source || "") &&
      /dati illimitati/i.test(l.source || "")
  )
);
ok(
  "OCR Visto 230 / skip Totale",
  ocrLines.some((l) => l.title === "Visto" && l.unitCents === 23000) &&
    !ocrLines.some((l) => /totale/i.test(l.title))
);
const viaTable = parsePreventivoTableText(ocrLike, { sourceName: "foto" });
ok(
  "tableText prefers OCR parse for space sheet",
  viaTable.length === 9 && viaTable.some((l) => l.title === "Volo" && l.unitCents === 98700)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
