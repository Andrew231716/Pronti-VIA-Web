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
const ux = readFileSync("ux-suite.js", "utf8");
const plat = readFileSync("pv-platform.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("text size key + map", /TEXT_KEY/.test(accountJs) && /TEXT_SIZES/.test(accountJs) && /Piccolo/.test(accountJs));
ok("apply/read helpers", /function applyTextSize/.test(accountJs) && /function readTextSize/.test(accountJs));
ok("window API", /__pvApplyTextSize/.test(accountJs) && /__pvGetTextSize/.test(accountJs));
ok("css zoom var", /--pv-text-zoom/.test(accountCss) && /data-pv-text/.test(accountCss));
ok("settings UI block", /textSizeControlsHtml/.test(ux) && /wireTextSizeControls/.test(ux) && /Grandezza del carattere/.test(ux));
ok("settings wired on mount", /wireTextSizeControls\(body\)/.test(ux));
ok("hub aspetto select", /id="pv-text-size"/.test(plat) && /setTextSize: applyTextSize/.test(plat));
ok(
  "stamps",
  /account\.js\?v=20261118g/.test(index) &&
    /account\.css\?v=20261118b/.test(index) &&
    /ux-suite-20261118g\.js/.test(index) &&
    /pv-platform-20261118c\.js/.test(index) &&
    /20261118g/.test(sw)
);
ok(
  "assets",
  existsSync("assets/ux-suite-20261118g.js") &&
    existsSync("assets/pv-platform-20261118c.js") &&
    /const STYLE_VER = "20261118g"/.test(readFileSync("assets/ux-suite-20261118g.js", "utf8")) &&
    /const VER = "20261118c"/.test(readFileSync("assets/pv-platform-20261118c.js", "utf8"))
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
