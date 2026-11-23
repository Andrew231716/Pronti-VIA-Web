#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const account = readFileSync("account.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const ins = readFileSync("assicurazione.js", "utf8");
const spaPath = "assets/index-loadfix-20261120w.js";
const spa = readFileSync(spaPath, "utf8");

ok(
  "stamps 20261120w",
  /const SHELL_VER = "20261120w"/.test(account) &&
    /index-loadfix-20261120w\.js/.test(account) &&
    /account\.js\?v=20261120w/.test(index) &&
    /ux-suite-20261120w\.js/.test(index) &&
    /assicurazione-20261120w\.js/.test(index) &&
    /20261120w-postassicura/.test(sw) &&
    /index-loadfix-20261120w\.js/.test(sw) &&
    /ux-suite-20261120w\.js/.test(sw) &&
    /assicurazione-20261120w\.js/.test(sw) &&
    existsSync(spaPath) &&
    existsSync("assets/ux-suite-20261120w.js") &&
    existsSync("assets/assicurazione-20261120w.js") &&
    readFileSync("assets/ux-suite-20261120w.js", "utf8") === ux &&
    readFileSync("assets/assicurazione-20261120w.js", "utf8") === ins
);

ok(
  "SPA empty home when prefer-home + recent trips",
  spa.includes("hasRecent") &&
    spa.includes("h&&hasRecent") &&
    spa.includes("I tuoi viaggi") &&
    spa.includes("pv-prefer-home-v1")
);

ok(
  "ux hides Creta demo under real resume",
  /STYLE_VER = "20261120w"/.test(ux) &&
    /pv-home-real-only/.test(ux) &&
    /syncHomeDemoVisibility/.test(ux) &&
    /main\.app-shell\.pv-home-real-only > \.demo-notice/.test(ux) &&
    /main\.app-shell\.pv-home-real-only > \.trip-cover/.test(ux) &&
    /main\.app-shell\.pv-home-real-only > \.footer/.test(ux)
);

ok(
  "assicurazione restores all hidden SPA panels",
  /STYLE_VER = "20261120w"/.test(ins) &&
    /hiddenByInsurance/.test(ins) &&
    /restoreHiddenSpaPanels/.test(ins) &&
    /tickTimer/.test(ins) &&
    !/other\.style\.display = "none"/.test(ins) &&
    /mo\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\)/.test(ins)
);

if (process.exitCode) process.exit(1);
console.log("fix-post-assicura 20261120w ok");
