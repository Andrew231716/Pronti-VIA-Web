import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const plat = readFileSync(join(root, "pv-platform.js"), "utf8");
const dest = readFileSync(join(root, "destination-theme.js"), "utf8");
const account = readFileSync(join(root, "account.css"), "utf8");
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

test("stamps 20261111d wired", () => {
  assert.match(index, /pv-platform-20261111f\.js/);
  assert.match(index, /destination-theme-20261111h\.js/);
  assert.match(index, /account\.css\?v=20261111c/);
  assert.match(index, /expense-splitwise-20261111f\.js/);
});

test("Hub tokens alias into app shell", () => {
  assert.match(plat, /--pv-account-ink: var\(--pv-plat-ink\)/);
  assert.match(plat, /#pv-primary-nav \.pv-primary-nav-inner/);
  assert.match(plat, /background: var\(--pv-plat-accent\) !important/);
  assert.match(plat, /body\.pv-account-ready/);
});

test("destination remaps full Hub palette", () => {
  assert.match(dest, /--pv-plat-ink: var\(--pv-dest-ink\)/);
  assert.match(dest, /--pv-plat-panel-bg:/);
  assert.match(dest, /Authorization: `Bearer \$\{auth\.key\}`/);
});

test("bottom nav active uses accent fill", () => {
  assert.match(account, /#pv-primary-nav \.pv-nav-item\.is-active \.pv-nav-ico/);
  assert.match(account, /background: var\(--pv-account-teal\);/);
});

console.log(process.exitCode ? "\nFAILED" : "\nOK");
