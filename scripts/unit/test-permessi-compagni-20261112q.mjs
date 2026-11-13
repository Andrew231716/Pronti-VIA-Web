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
const shim = readFileSync("api-shim.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("setMemberRole helper", /async function setMemberRole\(/.test(magic) && /__pvSetMemberRole/.test(magic));
ok("roles persist in meta.roles", /meta\.roles/.test(magic) && /normalizeCompanionRole/.test(magic));
ok("scrub roles on remove", /delete nextRoles\[target\.id\]/.test(magic));
ok(
  "companions UI permission select",
  /data-role-id/.test(ux) && /Solo lettura/.test(ux) && /Può modificare/.test(ux)
);
ok("companions wires __pvSetMemberRole", /__pvSetMemberRole/.test(ux));
ok("soft canEdit from roles", /applySoftMemberCanEdit/.test(shim) && /softRoleBlocksEdit/.test(shim));
ok("soft readonly blocks PUT", /sola lettura su questo viaggio/.test(shim));
ok(
  "stamps wired",
  /api-shim-20261112r\.js/.test(index) &&
    /magic-extras-20261113a\.js/.test(index) &&
    /ux-suite-20261112r\.js/.test(index)
);
ok(
  "sw precache matches",
  /api-shim-20261112r\.js/.test(sw) &&
    /magic-extras-20261113a\.js/.test(sw) &&
    /ux-suite-20261112r\.js/.test(sw) &&
    /20261113a/.test(sw)
);
ok(
  "assets exist",
  existsSync("assets/api-shim-20261112r.js") &&
    existsSync("assets/magic-extras-20261113a.js") &&
    existsSync("assets/ux-suite-20261112r.js")
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
