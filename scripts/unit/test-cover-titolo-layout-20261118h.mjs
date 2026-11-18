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
  "title lifted above green strip",
  /bottom:\s*calc\(100% \+ \.15rem\)/.test(diary) &&
    /padding:\s*2\.5rem \.9rem \.95rem/.test(diary)
);
ok(
  "no title max-height clip",
  /max-height:\s*none/.test(diary) &&
    /overflow:\s*visible/.test(diary) &&
    !/max-height:\s*38%/.test(diary)
);
ok("magic mirrors title padding", /bottom:calc\(100% \+ \.15rem\)/.test(magic.replace(/\s+/g, "")) || /bottom:calc\(100% \+ \.15rem\)/.test(magic));
ok(
  "stamps",
  /magic-extras-20261118h\.js/.test(index) &&
    /ux-suite-20261118h\.js/.test(index) &&
    /travel-diary\.css\?v=20261118h/.test(index) &&
    /20261118h/.test(sw)
);
ok(
  "assets",
  existsSync("assets/magic-extras-20261118h.js") &&
    existsSync("assets/ux-suite-20261118h.js") &&
    readFileSync("assets/magic-extras-20261118h.js", "utf8").includes('dataset.pvReady = "20261118h"')
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
