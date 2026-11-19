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
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("home beside helper", /pv-home-nuovo/.test(accountJs) && /pv-theme-toggle--home/.test(accountJs));
ok("places beside Nuovo viaggio", /nuovo viaggio/i.test(accountJs) && /setMode\("home"\)/.test(accountJs) && /insertAdjacentElement\("afterend"/.test(accountJs));
ok("trip still uses topbar", /setMode\("topbar"\)/.test(accountJs) && /#root \.topbar/.test(accountJs));
ok("gate still floats", /setMode\("float"\)/.test(accountJs));
ok("home row css", /pv-home-nuovo/.test(accountCss) && /pv-theme-toggle--home/.test(accountCss));
ok("home toggle static", /pv-theme-toggle--home[\s\S]*position:\s*static/.test(accountCss));
ok(
  "stamps",
  /account\.js\?v=20261119b/.test(index) &&
    /account\.css\?v=20261118b/.test(index) &&
    /account\.js\?v=20261119b/.test(sw) &&
    /20261119k-meteo/.test(sw)
);
ok("shell ver", /const SHELL_VER = "20261119b"/.test(accountJs));
ok("files exist", existsSync("account.js") && existsSync("account.css"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
