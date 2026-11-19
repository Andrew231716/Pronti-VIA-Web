#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

const ok = (name, cond) => {
  if (!cond) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
};

const magic = readFileSync("magic-extras.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "phase follows active tab (Vedi spese → trip)",
  /phaseRequiredByActiveTab/.test(ux) &&
    /required && required !== phase/.test(ux) &&
    /bindVediSpesePhasePromotion/.test(ux) &&
    /Vedi spese/i.test(ux) &&
    /sessionStorage\.setItem\(TRIP_PHASE_KEY, "trip"\)/.test(ux)
);

const normalizeFn = magic.slice(
  magic.indexOf("function normalizeStopDay"),
  magic.indexOf("function stopNeedsDay")
);
ok(
  "normalizeStopDay does not clamp or fall back to day 1",
  /Out of trip range/.test(normalizeFn) &&
    /Do NOT fall back to day 1/.test(normalizeFn) &&
    !/days\[0\]/.test(normalizeFn) &&
    /return days\[idx\] \|\| ""/.test(normalizeFn) &&
    /v < start\) return ""/.test(normalizeFn) &&
    /v > end\) return ""/.test(normalizeFn)
);

ok(
  "organize card uses strict day-slot matching",
  /function stopNeedsDay/.test(magic) &&
    /function refreshOrganizeOverviewCard/.test(magic) &&
    /days\.includes\(raw\)/.test(magic) &&
    /refreshOrganizeOverviewCard\(\)/.test(magic)
);

ok(
  "stamps",
  /magic-extras-20261119x\.js/.test(index) &&
    /ux-suite-20261119v\.js/.test(index) &&
    /20261119x-verificato/.test(sw) &&
    /const SHELL_VER = "20261119x"/.test(account) &&
    existsSync("assets/magic-extras-20261119x.js") &&
    existsSync("assets/ux-suite-20261119v.js") &&
    /dataset\.pvReady = "20261119x"/.test(magic) &&
    /const STYLE_VER = "20261119v"/.test(ux)
);

if (process.exitCode) process.exit(process.exitCode);
console.log("all ok");
