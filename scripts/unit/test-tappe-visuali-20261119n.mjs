#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
let failed=0;
function ok(n,c,d=""){ if(c) console.log(`PASS  ${n}${d?` — ${d}`:""}`); else {failed++; console.log(`FAIL  ${n}${d?` — ${d}`:""}`);} }
const magic=readFileSync("magic-extras.js","utf8");
const ux=readFileSync("ux-suite.js","utf8");
const dest=readFileSync("destination-theme.js","utf8");
const index=readFileSync("index.html","utf8");
const sw=readFileSync("sw.js","utf8");
ok("category stickers", /STOP_CATEGORY_STICKER/.test(magic) && /pv-stop-sticker/.test(magic) && /pv-stop-enhanced/.test(magic));
ok("sposta-al replaces day label", /pv-stop-move/.test(magic) && /Sposta al/.test(magic) && !/Giorno della tappa/.test(magic));
ok("timeline + larger media", /width:92px/.test(ux) && /stop-card::before/.test(ux) && /grid-template-columns:auto minmax\(0,1fr\)/.test(ux));
ok("ghana stop accents", /pv-stop-sticker/.test(dest) && /stop-card::before/.test(dest));
ok("stamps", /ux-suite-20261120u\.js/.test(index) && /magic-extras-20261120s\.js/.test(index) && /20261120u-inslayout/.test(sw) && existsSync("assets/ux-suite-20261120u.js") && /const STYLE_VER = "20261120u"/.test(ux) && /dataset\.pvReady = "20261120s"/.test(magic));
if(failed){console.log(`\n${failed} FAIL`); process.exit(1);} console.log("\nOK");
