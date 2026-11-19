#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
let failed=0;
function ok(n,c,d=""){ if(c) console.log(`PASS  ${n}${d?` — ${d}`:""}`); else {failed++; console.log(`FAIL  ${n}${d?` — ${d}`:""}`);} }
const dest=readFileSync("destination-theme.js","utf8");
const diary=readFileSync("travel-diary.css","utf8");
const index=readFileSync("index.html","utf8");
const sw=readFileSync("sw.js","utf8");
ok("empty-state forced white on Ghana", /\.empty-state/.test(dest) && /background:#fff !important/.test(dest) && /border-style:solid !important/.test(dest));
ok("day-heading count readable", /day-heading > span/.test(dest) && /#3a4630/.test(dest));
ok("diary wash no longer olive card fill", /html\[data-pv-dest="gh"\][\s\S]*--diary-wash: #ffffff/.test(diary));
ok("stamps", /destination-theme-20261119p\.js/.test(index) && /20261119p-contrasto/.test(sw) && /account\.js\?v=20261119p/.test(index) && existsSync("assets/destination-theme-20261119p.js"));
if(failed){console.log(`\n${failed} FAIL`); process.exit(1);} console.log("\nOK");
