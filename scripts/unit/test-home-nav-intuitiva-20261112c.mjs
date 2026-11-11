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

const ux = readFileSync("ux-suite.js", "utf8");
const account = readFileSync("account.js", "utf8");
const plat = readFileSync("pv-platform.js", "utf8");
const index = readFileSync("index.html", "utf8");

ok("home lock helper", /lockPrimaryNav\(/.test(ux) && /primaryNavLockActive/.test(ux));
ok("soft leave trip", /leaveOpenTripSoft/.test(ux) && /pv-prefer-home-v1/.test(ux));
ok("reload only as fallback", /SPA still keeps the trip workspace/.test(ux) && /location\.reload\(\)/.test(ux));
ok("sync respects home lock", /primaryNavLockActive\("home"\)/.test(ux));
ok("guest Home blocked", /isGuestAccount/.test(ux) && /viaggio condiviso/.test(ux));
ok("guest Home hidden", /home\.hidden = guest/.test(ux));
ok("onboard clarifies Home exits trip", /Home ti fa uscire/.test(ux));
ok("account Home title mentions exit", /esce dal viaggio/.test(account));
ok("account guest Home guard", /session\?\.guest/.test(account));
ok("hub close respects nav lock", /__pvPrimaryNavLock/.test(plat));
ok("ux stamp wired", /ux-suite-20261112h\.js/.test(index));
ok("asset exists", existsSync("assets/ux-suite-20261112h.js"));

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
