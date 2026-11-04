#!/usr/bin/env node
/**
 * Bacchetta Lingua: help speak the local language of the destination.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

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

const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");

test("Lingua stamp wired", () => {
  assert.match(index, /magic-extras-20261104e\.js/);
});

test("Lingua UI is speak-on-the-ground oriented", () => {
  assert.match(magic, /parlare sul posto/);
  assert.match(magic, /Come si dice/);
  assert.match(magic, /Ascolta/);
  assert.match(magic, /speakLocalText/);
  assert.match(magic, /speechSynthesis/);
  assert.match(magic, /LANG_SITUATIONS/);
  assert.match(magic, /buildLocalPhrasebook/);
});

test("languageForDestination maps local languages (not EN placeholders)", () => {
  const el = () => ({
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    URLSearchParams,
    URL,
    AbortSignal: { timeout: () => ({}) },
    fetch: async () => ({ json: async () => ({}) }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { hash: "", href: "http://localhost/", reload() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    SpeechSynthesisUtterance: class {},
  };
  sandbox.document = {
    body: { classList: { contains: () => false, add() {}, remove() {}, toggle() {} }, appendChild() {} },
    head: { appendChild() {} },
    documentElement: el(),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => el(),
    addEventListener() {},
    removeEventListener() {},
    readyState: "complete",
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  sandbox.speechSynthesis = { cancel() {}, speak() {}, getVoices: () => [] };

  vm.runInNewContext(magic, sandbox, { timeout: 8000 });
  const fn = sandbox.window.__pvLanguageForDestination;
  assert.equal(typeof fn, "function");
  assert.equal(fn("Parigi, Francia").code, "fr");
  assert.equal(fn("Oslo, Norvegia").code, "no");
  assert.equal(fn("Reykjavík").code, "is");
  assert.equal(fn("Tokyo").code, "ja");
  assert.equal(fn("Roma, Italia").code, "it");
  assert.equal(fn("Roma, Italia").home, true);
  assert.equal(fn("Oslo").code, "no");
  assert.doesNotMatch(fn("Oslo").name, /base EN/);
  assert.match(fn("Barcellona").pair, /it\|es/);
});

test("MyMemory remains the free translator (no paid APIs)", () => {
  assert.match(magic, /api\.mymemory\.translated\.net/);
  // Restrict the scan to translator call sites — avoid false positives in comments/CSS.
  const translateBlock = magic.slice(magic.indexOf("async function translateText"), magic.indexOf("function speakLocalText"));
  assert.doesNotMatch(translateBlock, /openai|anthropic|deepl|googleapis/i);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
