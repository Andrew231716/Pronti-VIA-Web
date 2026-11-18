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

const prev = readFileSync("preventivo-islanda.js", "utf8");
const stamped = "assets/preventivo-islanda-20261117e.js";
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const stampSrc = existsSync(stamped) ? readFileSync(stamped, "utf8") : "";

ok("VERSION bump", /const VERSION = "20261117e"/.test(prev));
ok("NAV_GROUPS present", /const NAV_GROUPS = \[/.test(prev) && /id: "riepilogo"/.test(prev) && /id: "organizza"/.test(prev));
ok("grouped nav markup", /pv-prev-nav/.test(prev) && /pv-prev-subnav/.test(prev) && /data-nav-group=/.test(prev));
ok("hero overview", /class="pv-hero"/.test(prev) && /pv-quick/.test(prev) && /pv-stat-grid/.test(prev));
ok("budget line cards", /pv-budget-line/.test(prev) && /data-del-line=/.test(prev) && /add-budget-line/.test(prev));
ok("soft budget totals", /function refreshBudgetHeroDom/.test(prev) && /function spentFromTrip/.test(prev));
ok("secondary actions collapsed", /pv-prev-more/.test(prev) && /Altre azioni/.test(prev));
ok(
  "stamp wired",
  /preventivo-islanda-20261117e\.js/.test(index) &&
    /preventivo-islanda-20261117e\.js/.test(sw) &&
    /20261118d/.test(sw) &&    existsSync(stamped) &&
    stampSrc.includes('const VERSION = "20261117e"') &&
    stampSrc.includes("NAV_GROUPS")
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll preventivo UI checks passed.");
