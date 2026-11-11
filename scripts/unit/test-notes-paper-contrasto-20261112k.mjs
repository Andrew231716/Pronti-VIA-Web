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
const account = readFileSync("account.css", "utf8");
const dest = readFileSync("destination-theme.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok(
  "platform notes-paper dark ink",
  /html\[data-pv-theme="dark"\] #root \.notes-paper[\s\S]*color:\s*#12343c/.test(plat)
);
ok(
  "diary notes-paper in paper list",
  /\.notes-paper\)/.test(diary) &&
    /html\[data-pv-theme="dark"\] #root \.notes-paper[\s\S]*#12343c/.test(diary)
);
ok(
  "account dark nav labels",
  /html\[data-pv-theme="dark"\] #pv-primary-nav \.pv-primary-nav-inner \.pv-nav-item[\s\S]*#c5d6da/.test(
    account
  )
);
ok(
  "dest dark nav labels",
  /html\[data-pv-theme="dark"\] body\.pv-dest-theme-ready #pv-primary-nav \.pv-nav-item\{[\s\S]*#c5d6da/.test(
    dest
  )
);
ok(
  "stamps",
  /pv-platform-20261112k\.js/.test(index) &&
    /travel-diary\.css\?v=20261112k/.test(index) &&
    /account\.css\?v=20261112k/.test(index) &&
    /destination-theme-20261112k\.js/.test(index)
);
ok(
  "assets exist",
  existsSync("assets/pv-platform-20261112k.js") &&
    existsSync("assets/destination-theme-20261112k.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
