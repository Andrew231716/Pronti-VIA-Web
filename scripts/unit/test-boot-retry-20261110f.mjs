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
  assert.match(index, /account.js\?v=20261119m/);
});

test("loadApp retries and watches empty root", () => {
  assert.match(account, /watchAppMount/);
  assert.match(account, /showAppBootFallback/);
  assert.match(account, /rootHasApp/);
  assert.match(account, /__pvLoadApp/);
  assert.match(account, /force:\s*true|force = true|\{ force/);
  assert.match(account, /Never cache-bust offline/);
});

test("service worker refuses HTML as JS cache", () => {
  assert.match(sw, /jsContentOk/);
  assert.match(sw, /freshIsJsOk/);
  assert.match(sw, /20261119m-visibile/);
});
console.log(process.exitCode ? "\nFAILED" : "\nOK");
