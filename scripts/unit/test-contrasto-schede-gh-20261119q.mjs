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
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "empty-state forced white on Ghana light",
  /\.empty-state/.test(dest) &&
    /background:#fff !important/.test(dest) &&
    /border-style:solid !important/.test(dest)
);
ok("day-heading count readable", /day-heading > span/.test(dest) && /#3a4630/.test(dest));
ok(
  "diary wash no longer olive card fill",
  /html\[data-pv-dest="gh"\][\s\S]*--diary-wash: #ffffff/.test(diary)
);
ok(
  "light Ghana ink scoped not-dark",
  /html\[data-pv-dest="gh"\]:not\(\[data-pv-theme="dark"\]\)[\s\S]*color:#29271e !important/.test(dest)
);
ok(
  "dark Ghana cards light ink",
  /html\[data-pv-theme="dark"\]\[data-pv-dest="gh"\][\s\S]*color:#edf5f5 !important/.test(dest) &&
    /Dark Ghana: light ink/.test(dest)
);
ok(
  "dark Ghana nested card text",
  /html\[data-pv-theme="dark"\]\[data-pv-dest="gh"\][\s\S]*color:#d7e6e8 !important/.test(dest)
);
ok(
  "dark Ghana day-strip unselected readable",
  /data-pv-theme="dark"\]\[data-pv-dest="gh"\][\s\S]*day-strip > button:not\(\.selected\)[\s\S]*color:#edf5f5 !important/.test(
    dest
  )
);
ok(
  "diary dark Ghana empty/stop ink",
  /data-pv-theme="dark"\]\[data-pv-dest="gh"\][\s\S]*\.empty-state[\s\S]*color: #edf5f5 !important/.test(
    diary
  )
);
ok(
  "stamps",
  /destination-theme-20261119u\.js/.test(index) &&
    /20261119w-preventivo/.test(sw) &&
    /account\.js\?v=20261119u/.test(index) &&
    /const SHELL_VER = "20261119w"/.test(account) &&
    existsSync("assets/destination-theme-20261119u.js")
);
ok(
  "asset mirrors source",
  readFileSync("assets/destination-theme-20261119u.js", "utf8") === dest
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
