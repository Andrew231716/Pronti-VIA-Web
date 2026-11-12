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

const account = readFileSync("account.js", "utf8");
const shim = readFileSync("api-shim.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("pending share key", /pv-pending-share-v1/.test(account));
ok("capture before logout", /async function onLogout\([\s\S]*capturePendingShareFromLocation/.test(account));
ok("restore on activate", /restorePendingShareHash\(\)/.test(account));
ok("owner switch carries guest recent", /Guest\/anon → real account/.test(account) || /!previousOwner/.test(account));
ok("prefer account gate", /pv-prefer-account-gate-v1/.test(account) && /setPreferAccountGate/.test(account));
ok(
  "hashHasSharedTrip pending",
  /function hashHasSharedTrip[\s\S]*readPendingShare\(\)[\s\S]*invito/.test(account)
);
ok("invite text keeps hash backup", /Link diretto:/.test(shim) && /hashUrl/.test(shim));
ok("invito path writes pending", /__pvWritePendingShare/.test(shim));
ok("ux upgrade account", /upgrade-account/.test(ux) && /Accedi o crea account/.test(ux));
ok(
  "stamps",
  /account\.js\?v=20261112o/.test(index) &&
    /api-shim-20261112p\.js/.test(index) &&
    /ux-suite-20261112p\.js/.test(index)
);
ok(
  "assets exist",
  existsSync("assets/api-shim-20261112p.js") && existsSync("assets/ux-suite-20261112p.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
