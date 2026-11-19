#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
let failed = 0;
function ok(n, c, d = "") {
  if (c) console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  else {
    failed++;
    console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
  }
}
const dest = readFileSync("destination-theme.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "all-dest light panels sand→white",
  /Section frame: tint of page wash/.test(dest) &&
    /color-mix\(in srgb, var\(--pv-dest-sand, #f3f8f8\) 28%, #ffffff\)/.test(dest)
);
ok(
  "ghana light panel cream",
  /Ghana: gold PAGE wash/.test(dest) &&
    /color-mix\(in srgb, var\(--pv-dest-sand,#fff5df\) 34%, #ffffff\)/.test(dest)
);
ok(
  "diary panels tinted",
  /soft tint of destination sand toward white/.test(diary) && /color-mix\(in srgb, var\(--diary-wash/.test(diary)
);
ok(
  "ghana diary cream",
  /soft cream \(not pure white\)/.test(diary) &&
    /color-mix\(in srgb, var\(--pv-dest-sand, #fff5df\) 34%, #fff\)/.test(diary)
);
ok(
  "no pure-white section frame force",
  !/Section frame:[\s\S]{0,220}background: #ffffff !important/.test(dest)
);
ok(
  "dedupe time pills",
  /Keep a single display pill/.test(magic) && /pills\.slice\(1\)\.forEach/.test(magic)
);
ok(
  "removed Prima/Dopo extras",
  /drop the redundant Prima\/Dopo row/.test(magic) && !/up\.textContent = "↑ Prima"/.test(magic)
);
ok(
  "stamps",
  /destination-theme-20261119u\.js/.test(index) &&
    /magic-extras-20261120a\.js/.test(index) &&
    /ux-suite-20261119z\.js/.test(index) &&
    /20261120a-iafile/.test(sw) &&
    /SHELL_VER = "20261120a"/.test(account) &&
    existsSync("assets/destination-theme-20261119u.js")
);
ok("assets mirror", readFileSync("assets/destination-theme-20261119u.js", "utf8") === dest);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
