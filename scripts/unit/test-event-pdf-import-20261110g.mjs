#!/usr/bin/env node
/**
 * Event import PDF support wiring (accept + pdf.js vendor + extractor).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

test("ux-suite stamp in index/sw", () => {
  assert.match(index, /ux-suite-20261110g\.js/);
  assert.match(sw, /ux-suite-20261110g\.js/);
  assert.match(sw, /assets\/vendor\/pdfjs\/pdf\.min\.js/);
  assert.match(sw, /assets\/vendor\/pdfjs\/pdf\.worker\.min\.js/);
});

test("vendor pdf.js present", () => {
  assert.equal(existsSync("assets/vendor/pdfjs/pdf.min.js"), true);
  assert.equal(existsSync("assets/vendor/pdfjs/pdf.worker.min.js"), true);
});

test("file picker accepts PDF", () => {
  assert.match(ux, /accept="[^"]*\.pdf[^"]*application\/pdf[^"]*"/);
});

test("PDF text extraction path", () => {
  assert.match(ux, /async function extractPdfText/);
  assert.match(ux, /function loadPdfJs/);
  assert.match(ux, /endsWith\("\.pdf"\)/);
  assert.match(ux, /PDF senza testo estraibile/);
  assert.match(ux, /window\.__pvExtractPdfText = extractPdfText/);
  assert.match(ux, /window\.__pvReadImportFile = readImportFile/);
});

test("home CTA mentions PDF", () => {
  assert.match(ux, /Crea viaggio da evento/);
  assert.match(ux, /importa PDF/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
