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

const plat = readFileSync("pv-platform.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const index = readFileSync("index.html", "utf8");

ok("platform share-box dark ink", /html\[data-pv-theme="dark"\][\s\S]*\.share-box h3[\s\S]*#12343c/.test(plat));
ok("platform dialog-title ink", /data-slot="dialog-title"[\s\S]*#12343c/.test(plat));
ok("diary dialog-title ink", /data-slot="dialog-title"[\s\S]*#12343c/.test(diary));
ok("stamps", /pv-platform-20261112m\.js/.test(index) && /travel-diary\.css\?v=20261112n/.test(index));
ok("asset exists", existsSync("assets/pv-platform-20261112m.js"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
