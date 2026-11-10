import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(join(root, "destination-theme.js"), "utf8");
const index = readFileSync(join(root, "index.html"), "utf8");

function test(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (err) { console.error(`FAIL  ${name}: ${err.message}`); process.exitCode = 1; }
}

test("stamp destination-theme-20261111a wired", () => {
  assert.match(index, /destination-theme-20261111a\.js/);
});

test("canvas destination load uses Bearer + hints", () => {
  assert.match(src, /Authorization: `Bearer \$\{auth\.key\}`/);
  assert.match(src, /readTripHints/);
  assert.match(src, /mix-blend-mode: multiply/);
  assert.doesNotMatch(src, /#pv-dest-atmosphere\{ display:none/);
});

console.log(process.exitCode ? "\nFAILED" : "\nOK");
