import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const account = readFileSync(join(root, "account.js"), "utf8");
const sw = readFileSync(join(root, "sw.js"), "utf8");
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

test("account.js stamp wired", () => {
  assert.match(sw, /20261118b/);});

console.log(process.exitCode ? "\nFAILED" : "\nOK");
