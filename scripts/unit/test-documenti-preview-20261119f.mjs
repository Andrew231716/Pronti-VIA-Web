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

const ux = readFileSync("ux-suite.js", "utf8");
const shim = readFileSync("api-shim.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "ux anteprima button + openTripDocumentPreview",
  /function openTripDocumentPreview/.test(ux) &&
    /function enhanceDocumentFilePreview/.test(ux) &&
    /Anteprima \$\{name\}/.test(ux) &&
    /pv-doc-preview-btn/.test(ux)
);
ok(
  "ux pdf.js pages renderer",
  /function renderPdfPreviewPages/.test(ux) &&
    /\/vendor\/pdfjs\/pdf\.min\.mjs/.test(ux) &&
    /guessDocumentPreviewKind/.test(ux)
);
ok(
  "ux preview kinds image/pdf/text",
  /return "image"/.test(ux) && /return "pdf"/.test(ux) && /return "text"/.test(ux)
);
ok(
  "ux tick wires enhanceDocumentFilePreview",
  /run\(enhanceDocumentFilePreview\)/.test(ux)
);
ok(
  "ux style ver 20261119f",
  /const STYLE_VER = "20261119k"/.test(ux)
);
ok(
  "shim serves files inline for preview",
  /Content-Disposition": `inline; filename=/.test(shim)
);
ok(
  "stamps wired",
  /ux-suite-20261119k\.js/.test(index) && /api-shim-20261119f\.js/.test(index)
);
ok(
  "sw precache matches",
  /ux-suite-20261119k\.js/.test(sw) && /api-shim-20261119f\.js/.test(sw)
);
ok(
  "assets exist and match sources",
  existsSync("assets/ux-suite-20261119k.js") &&
    existsSync("assets/api-shim-20261119f.js") &&
    readFileSync("assets/ux-suite-20261119k.js", "utf8") === ux &&
    readFileSync("assets/api-shim-20261119f.js", "utf8") === shim
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
