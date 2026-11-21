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
  "ux exports import helpers for chat",
  /window\.__pvReadImportFile = readImportFile/.test(ux) &&
    /window\.__pvApplyImportItemsToTrip = applyImportItemsToTrip/.test(ux) &&
    /window\.__pvRenderImportItems = renderImportItems/.test(ux) &&
    /window\.__pvRekindImportItem = rekindImportItem/.test(ux) &&
    /function rekindImportItem/.test(ux)
);

ok(
  "uncertain fallbacks (AI + gaps + clarify)",
  /askAiToClassifyImport/.test(magic) &&
    /importItemGaps/.test(magic) &&
    /noteItemFromRawText/.test(magic) &&
    /pv-chat-missing/.test(magic) &&
    /data-clarify/.test(magic) &&
    /Seconda lettura IA/.test(magic)
);

ok(
  "chat file attach + analyze + apply",
  /pv-chat-attach/.test(magic) &&
    /function analyzeChatFiles/.test(magic) &&
    /function renderChatImportReview/.test(magic) &&
    /function applyChatImportDraft/.test(magic) &&
    /function refineChatImportFromText/.test(magic) &&
    /Invia alle sezioni/.test(magic) &&
    /ocrImageToText/.test(magic)
);

ok(
  "chat refinement commands",
  /sono voli/.test(magic) &&
    /sono hotel/.test(magic) &&
    /all\['’\]\?itinerario/.test(magic) &&
    /refineChatImportFromText\(text\)/.test(magic) &&
    /data-chat-imp-apply/.test(magic)
);

ok(
  "stamps",
  /magic-extras-20261120p\.js/.test(index) &&
    /ux-suite-20261120d\.js/.test(index) &&
    /20261120p-bleed/.test(sw) &&
    /const SHELL_VER = "20261120p"/.test(account) &&
    existsSync("assets/magic-extras-20261120p.js") &&
    existsSync("assets/ux-suite-20261120d.js") &&
    /dataset\.pvReady = "20261120p"/.test(magic) &&
    /const STYLE_VER = "20261120d"/.test(ux)
);

if (process.exitCode) process.exit(process.exitCode);
console.log("all ok");
