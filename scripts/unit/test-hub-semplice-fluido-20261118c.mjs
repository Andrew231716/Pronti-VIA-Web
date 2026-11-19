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
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("flat hub tabs", /const HUB_TABS/.test(plat) && /flat-v1/.test(plat));
ok("no Collabora/Organizza groups", !/HUB_GROUPS/.test(plat) && !/data-plat-group/.test(plat));
ok("visible tabs are group-only", /Votazioni/.test(plat) && /Inviti/.test(plat) && /Ricordi/.test(plat));
ok("jumps to trip sections", /jumpToTripSection/.test(plat) && /data-plat="goto-section"/.test(plat));
ok("opens app settings from hub", /open-app-settings/.test(plat) && /__pvOpenSettingsMenu/.test(plat));
ok("trip fetch cache", /tripCache/.test(plat) && /clearTripCache/.test(plat) && /force:\s*true/.test(plat));
ok("legacy workflow bar removed", /pv-trip-workflow"\)\.forEach/.test(plat) || /\.pv-trip-workflow"\)\.forEach/.test(plat));
ok("tick splits home vs trip", /const inTrip = Boolean\(tripAuth\(\)\)/.test(ux) && /enhanceTripModeNav/.test(ux));
ok("tick debounce slower", /420/.test(ux));
ok(
  "stamps",
  /pv-platform-20261118c\.js/.test(index) &&
    /ux-suite-20261119b\.js/.test(index) &&
    /pv-platform-20261118c\.js/.test(sw) &&
    /20261118h/.test(sw)
);
ok(
  "assets",
  existsSync("assets/pv-platform-20261118c.js") &&
    existsSync("assets/ux-suite-20261119b.js") &&
    /const VER = "20261118c"/.test(readFileSync("assets/pv-platform-20261118c.js", "utf8"))
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
