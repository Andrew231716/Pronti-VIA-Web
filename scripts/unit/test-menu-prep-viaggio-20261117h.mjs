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
  /ux-suite-20261118c\.js/.test(index) &&
    /travel-diary\.css\?v=20261117h/.test(index) &&
    /ux-suite-20261118c\.js/.test(sw) &&
    /20261118c/.test(sw)
);
ok("asset mirrors source", existsSync("assets/ux-suite-20261118c.js") && stamped.includes('const STYLE_VER = "20261118c"'));
ok("style ver bumped", /const STYLE_VER = "20261118c"/.test(ux));ok("harness exists", existsSync("scripts/unit/harness-menu-prep.html"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
