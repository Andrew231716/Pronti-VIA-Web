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

const shim = readFileSync("api-shim.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("detect edit share key", /function isEditShareKey/.test(shim));
ok("edit skips /invito", /isEditShareKey\(tripId, key\)[\s\S]*return url\.toString\(\)/.test(shim));
ok("edit payload warns", /Link di MODIFICA/.test(shim) && /mode:\s*"edit"/.test(shim));
ok("read payload says sola lettura", /Sei invitato a «\$\{title\}» \(sola lettura\)/.test(shim));
ok("copy event dispatched", /pv-share-copied/.test(shim) && /pv-share-copied/.test(ux));
ok("share dialog pills", /pv-share-mode-pill/.test(ux) && /enhanceShareDialogClarity/.test(ux));
ok("edit warn in dialog", /pv-share-edit-warn/.test(ux));
ok(
  "stamps",
  /api-shim-20261112p\.js/.test(index) && /ux-suite-20261112p\.js/.test(index)
);
ok(
  "assets exist",
  existsSync("assets/api-shim-20261112p.js") && existsSync("assets/ux-suite-20261112p.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
