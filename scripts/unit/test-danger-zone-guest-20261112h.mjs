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
const account = readFileSync("account.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("confirm before delete-trip", /act === "delete-trip"[\s\S]*window\.confirm[\s\S]*skipConfirm:\s*true/.test(ux));
ok("confirm before delete-account", /act === "delete-account"[\s\S]*window\.confirm[\s\S]*skipConfirm:\s*true/.test(ux));
ok("guest hides trip danger", /const guest = isGuestAccount\(\)/.test(ux) && /tripDanger = guest/.test(ux));
ok("account delete only for own account", /hasOwnAccount/.test(ux) && /accountDanger/.test(ux));
ok("guest blocked in onDeleteAccount", /SESSION_KEY[\s\S]*guest[\s\S]*ospiti del link condiviso/.test(account) || /guest[\s\S]*non possono eliminare/.test(account));
ok("stamp ux h", /ux-suite-20261112r\.js/.test(index) && existsSync("assets/ux-suite-20261112r.js"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
