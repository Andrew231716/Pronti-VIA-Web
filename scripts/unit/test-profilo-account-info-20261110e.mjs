import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ux = readFileSync(join(root, "ux-suite.js"), "utf8");
const index = readFileSync(join(root, "index.html"), "utf8");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

test("stamp ux-suite wired", () => {
  assert.match(index, /ux-suite-20261112o\.js/);
});

test("Profilo shows account info helpers", () => {
  assert.match(ux, /renderAccountInfoBlock/);
  assert.match(ux, /readAccountSession/);
  assert.match(ux, /Nome utente/);
  assert.match(ux, /Nome visualizzato/);
  assert.match(ux, /Tipo account/);
  assert.match(ux, /data-ux-copy-user/);
  assert.match(ux, /accountKindLabel/);
  assert.match(ux, /\.pv-account-card/);
});

const passed = !process.exitCode;
console.log(`\n${passed ? "OK" : "FAILED"}`);
