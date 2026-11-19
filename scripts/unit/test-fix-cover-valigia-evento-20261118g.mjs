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

const magic = readFileSync("magic-extras.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "cover countdown top-left (no title overlap)",
  /pv-cover-countdown\{[^}]*top:\.75rem/.test(magic.replace(/\s+/g, "")) ||
    /#root \.pv-cover-countdown[\s\S]*?top:\s*\.75rem/.test(diary)
);
ok(
  "cover countdown meta hidden",
  /\.pv-cover-count-meta\{display:none\}/.test(magic.replace(/\s+/g, "")) ||
    /#root \.pv-cover-countdown \.pv-cover-count-meta\s*\{\s*display:\s*none/.test(diary)
);
ok(
  "valigia remount after template",
  /function remountTripSection\(/.test(magic) &&
    /remountTripSection\(auth,\s*"packing"\)/.test(magic) &&
    /pv-event-return-section/.test(magic)
);
ok(
  "packing reads private checklist",
  /viavia-private-packing-v1/.test(ux) && /pv-pack-cats/.test(ux)
);
ok(
  "event add button stable (no full rail rewrite)",
  /dataset\.listSig/.test(ux) &&
    /data-pv-event-add/.test(ux) &&
    !/rail\.innerHTML = `\$\{canEdit \? '<button type="button" class="button secondary" data-pv-event-add>/.test(ux)
);
ok(
  "stamps",
  /magic-extras-20261119m\.js/.test(index) &&
    /ux-suite-20261119m\.js/.test(index) &&
    /app-suite-20261118h\.js/.test(index) &&
    /travel-diary\.css\?v=20261119m-visibile/.test(index) &&
    /20261119m-visibile/.test(sw)
);
ok(
  "assets",
  existsSync("assets/magic-extras-20261119m.js") &&
    existsSync("assets/ux-suite-20261119m.js") &&
    existsSync("assets/app-suite-20261118h.js") &&
    readFileSync("assets/magic-extras-20261119m.js", "utf8").includes('dataset.pvReady = "20261119m"') &&
    readFileSync("assets/ux-suite-20261119m.js", "utf8").includes('const STYLE_VER = "20261119m"')
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
