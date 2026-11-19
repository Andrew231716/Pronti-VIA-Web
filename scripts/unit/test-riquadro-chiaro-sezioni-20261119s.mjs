#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
let failed=0;
function ok(n,c,d=""){ if(c) console.log(`PASS  ${n}${d?` — ${d}`:""}`); else {failed++; console.log(`FAIL  ${n}${d?` — ${d}`:""}`);} }
const dest=readFileSync("destination-theme.js","utf8");
const diary=readFileSync("travel-diary.css","utf8");
const magic=readFileSync("magic-extras.js","utf8");
const index=readFileSync("index.html","utf8");
const sw=readFileSync("sw.js","utf8");
const account=readFileSync("account.js","utf8");
ok("all-dest light panels white", /Section frame: always much lighter[\s\S]*background: #ffffff !important/.test(dest));
ok("ghana light panel white not gold", /Ghana: keep warm gold PAGE wash[\s\S]*background: #ffffff !important/.test(dest));
ok("diary panels white", /Section panels under the trip menu: clear white frame[\s\S]*background: #fff;/.test(diary));
ok("ghana diary panel white", /Ghana section frame: white[\s\S]*background: #fff;/.test(diary));
ok("no gold tabpanel gradient left", !/background: linear-gradient\(165deg, #e2d194/.test(dest));
ok("dedupe time pills", /Keep a single display pill/.test(magic) && /pills\.slice\(1\)\.forEach/.test(magic));
ok("removed Prima\/Dopo extras", /drop the redundant Prima\/Dopo row/.test(magic) && !/up\.textContent = "↑ Prima"/.test(magic));
ok("stamps", /destination-theme-20261119s\.js/.test(index) && /magic-extras-20261119s\.js/.test(index) && /ux-suite-20261119s\.js/.test(index) && /20261119s-riquadro/.test(sw) && /SHELL_VER = "20261119s"/.test(account) && existsSync("assets/destination-theme-20261119s.js") && existsSync("assets/magic-extras-20261119s.js") && existsSync("assets/ux-suite-20261119s.js"));
ok("assets mirror", readFileSync("assets/destination-theme-20261119s.js","utf8")===dest && readFileSync("assets/magic-extras-20261119s.js","utf8")===magic);
if(failed){console.log(`\n${failed} FAIL`); process.exit(1);} console.log("\nOK");
