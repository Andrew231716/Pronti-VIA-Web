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

const diary = readFileSync("travel-diary.css", "utf8");
const magic = readFileSync("magic-extras.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "title in meta strip (not absolute overlay)",
  /Title lives in the green meta strip/.test(diary) &&
    /position:\s*static/.test(diary) &&
    /color:\s*#f4fbf7/.test(diary)
);
ok(
  "no title edge clip rules",
  !/max-height:\s*38%/.test(diary) &&
    !/inset:\s*auto 0 100%/.test(diary.match(/trip-cover\[data-pv-trip-cover\] \.cover-content h1 \{[\s\S]*?\n\}/g)?.join("\n") || "")
);
ok(
  "magic forces static title",
  /position:static!important/.test(magic) && /color:#f4fbf7!important/.test(magic)
);
ok(
  "stamps",
  /magic-extras-20261119t\.js/.test(index) &&
    /ux-suite-20261119s\.js/.test(index) &&
    /travel-diary\.css\?v=20261119s-riquadro/.test(index) &&
    /20261119s-riquadro/.test(sw)
);
ok(
  "assets",
  existsSync("assets/magic-extras-20261119t.js") &&
    existsSync("assets/ux-suite-20261119s.js") &&
    readFileSync("assets/magic-extras-20261119t.js", "utf8").includes('dataset.pvReady = "20261119t"')
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
