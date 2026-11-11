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

const account = readFileSync("account.css", "utf8");
const dest = readFileSync("destination-theme.js", "utf8");
const plat = readFileSync("pv-platform.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("account dark ink tokens", /html\[data-pv-theme="dark"\][\s\S]*--pv-account-ink:\s*#eef6f7/.test(account));
ok("account dark nav muted", /html\[data-pv-theme="dark"\] #pv-primary-nav \.pv-nav-item[\s\S]*--pv-account-muted/.test(account));
ok("account dark chip who", /html\[data-pv-theme="dark"\] #pv-account-chip \.pv-account-chip-who/.test(account));
ok("dest dark remaps ink", /html\[data-pv-theme="dark"\]\[data-pv-dest\][\s\S]*--pv-plat-ink:\s*#eef6f7/.test(dest));
ok("dest dark nav item color", /body\.pv-dest-theme-ready #pv-primary-nav \.pv-nav-item\{[\s\S]*--pv-plat-muted/.test(dest));
ok("platform syncs .dark class", /classList\.toggle\("dark", dark\)/.test(plat));
ok("platform dark brand override", /html\[data-pv-theme="dark"\] #root \.brand/.test(plat));
ok("stamps wired", /account\.css\?v=20261112k/.test(index) && /destination-theme-20261112k\.js/.test(index));
ok("assets exist", existsSync("assets/destination-theme-20261112k.js") && existsSync("assets/pv-platform-20261112k.js"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
