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
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "platform money-stats dark ink",
  /html\[data-pv-theme="dark"\] #root \.money-stats > div[\s\S]*color:\s*#12343c/.test(plat)
);
ok(
  "platform money-stats first-child dark ink on white",
  /html\[data-pv-theme="dark"\] #root \.money-stats > div:first-child[\s\S]*#12343c/.test(plat) &&
    /html\[data-pv-theme="dark"\] #root \.money-stats > div:first-child[\s\S]*background:\s*#fff/.test(plat)
);
ok(
  "platform pv-budget-box / fx paper ink",
  /html\[data-pv-theme="dark"\] #root :is\(\.pv-budget-box,.pv-chart-box,.pv-day-weather,.pv-links-box,.pv-fx-calc/.test(
    plat
  )
);
ok(
  "platform field inputs dark ink",
  /html\[data-pv-theme="dark"\] #root \.app-shell \.field :is\(input, select, textarea\)[\s\S]*#12343c/.test(
    plat
  )
);
ok(
  "diary money-stats dark ink",
  /html\[data-pv-theme="dark"\] #root \.money-stats > div[\s\S]*#12343c/.test(diary)
);
ok(
  "diary budget-box + fx white paper",
  /\.pv-budget-box[\s\S]*\.pv-fx-calc[\s\S]*background:\s*#fff !important/.test(diary)
);
ok(
  "magic budget input explicit ink",
  /\.pv-budget-box input\{[^}]*color:#12343c/.test(magic)
);
ok(
  "magic dark theme budget/fx overrides",
  /html\[data-pv-theme="dark"\] \.pv-budget-box[\s\S]*#12343c/.test(magic)
);
ok(
  "stamps wired",
  /pv-platform-20261112m\.js/.test(index) &&
    /travel-diary\.css\?v=20261112n/.test(index) &&
    /magic-extras-20261112q\.js/.test(index)
);
ok(
  "sw precache matches stamps",
  /pv-platform-20261112m\.js/.test(sw) &&
    /travel-diary\.css\?v=20261112n/.test(sw) &&
    /magic-extras-20261112q\.js/.test(sw) &&
    /destination-theme-20261112k\.js/.test(sw)
);
ok(
  "assets exist",
  existsSync("assets/pv-platform-20261112m.js") &&
    existsSync("assets/magic-extras-20261112q.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
