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
const accountJs = readFileSync("account.js", "utf8");
const accountCss = readFileSync("account.css", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const dest = readFileSync("destination-theme.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("settings nav button", /id="pv-nav-settings"/.test(accountJs) && /data-nav="settings"/.test(accountJs));
ok("settings opens menu", /__pvOpenSettingsMenu/.test(accountJs) && /openSettingsMenu/.test(ux));
ok("organizza removed from profilo", !/openAccountMenu[\s\S]*🗺️ Organizza[\s\S]*window\.__pvOpenAccountMenu/.test(ux));
ok("settings hosts invita/notifiche", /settingsOrganizzaHtml/.test(ux) && /data-ux="invite"/.test(ux) && /data-ux="notifications"/.test(ux));
ok("gear icon in dest theme", /settings:/.test(dest) && /pv-nav-settings/.test(dest));
ok("login dark card", /html\[data-pv-theme="dark"\] #pv-account-gate \.pv-account-card/.test(accountCss));
ok("login dark inputs", /html\[data-pv-theme="dark"\] #pv-account-gate \.pv-account-field input/.test(accountCss));
ok("account field dark values", /html\[data-pv-theme="dark"\] \.pv-account-field dd\{color:#eef6f7\}/.test(ux));
ok("diary account field contrast", /#pv-ux-modal \.pv-account-field dd/.test(diary));
ok("7-col nav grid", /repeat\(7, minmax\(0, 1fr\)\)/.test(diary) || /repeat\(7, minmax\(0, 1fr\)\)/.test(accountCss));
ok("stamps wired", /ux-suite-20261112p\.js/.test(index) && /account\.css\?v=20261112k/.test(index) && /destination-theme-20261112k\.js/.test(index));
ok("assets exist", existsSync("assets/ux-suite-20261112p.js") && existsSync("assets/destination-theme-20261112k.js"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
