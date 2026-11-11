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

const accountJs = readFileSync("account.js", "utf8");
const accountCss = readFileSync("account.css", "utf8");
const plat = readFileSync("pv-platform.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("theme toggle button", /pv-theme-toggle/.test(accountJs) && /cycleThemeMode/.test(accountJs) && /ensureThemeToggle/.test(accountJs));
ok("theme mounts in topbar", /placeThemeToggle/.test(accountJs) && /pv-theme-toggle--topbar/.test(accountJs) && /#root \.topbar/.test(accountJs));
ok("default system theme", /mode: "system"/.test(accountJs) && /THEME_CYCLE/.test(accountJs));
ok("theme toggle css", /pv-theme-toggle--topbar/.test(accountCss) && /margin-left:\s*auto/.test(accountCss));
ok("platform theme API", /cycleTheme/.test(plat) && /getThemeMode/.test(plat) && /setTheme: applyTheme/.test(plat));
ok("profilo only account + danger", /openAccountMenu[\s\S]*Zona pericolosa[\s\S]*Il tuo account[\s\S]*__pvOpenAccountMenu/.test(ux) && /hasOwnAccount/.test(ux));
ok("profilo no azioni rapide", !/openAccountMenu[\s\S]*Azioni rapide[\s\S]*__pvOpenAccountMenu/.test(ux));
ok("tools moved to impostazioni", /settingsOrganizzaHtml[\s\S]*Cerca nel viaggio/.test(ux));
ok("stamps wired", /account\.js\?v=20261112j/.test(index) && /ux-suite-20261112i\.js/.test(index) && /pv-platform-20261112m\.js/.test(index));
ok("assets exist", existsSync("assets/ux-suite-20261112i.js") && existsSync("assets/pv-platform-20261112m.js"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
