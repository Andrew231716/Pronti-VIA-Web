#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const ux = readFileSync("ux-suite.js", "utf8");
const account = readFileSync("account.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "stamps 20261124b",
  /STYLE_VER = "20261124b"/.test(ux) &&
    /const SHELL_VER = "20261124b"/.test(account) &&
    /ux-suite-20261124b\.js/.test(index) &&
    /ux-suite-20261124b\.js/.test(sw) &&
    /20261124b-viaggi-share-lock/.test(sw) &&
    existsSync("assets/ux-suite-20261124b.js") &&
    readFileSync("assets/ux-suite-20261124b.js", "utf8") === ux
);

ok(
  "Nuovo viaggio + cestino nella sezione I tuoi viaggi",
  /pv-trips-sheet-actions/.test(ux) &&
    /data-ux-new-trip/.test(ux) &&
    /triggerSpaNewTrip/.test(ux) &&
    /function polishSpaTripsSheet/.test(ux) &&
    /pv-trips-sheet-bar/.test(ux) &&
    /button\.pv-home-nuovo[\s\S]*display:none!important/.test(ux) &&
    /pv-home-trash-wrap[\s\S]*display:none!important/.test(ux)
);

ok(
  "share link locks Home",
  /function isShareLinkSession/.test(ux) &&
    /pv-share-lock/.test(ux) &&
    /syncShareLockChrome/.test(ux) &&
    /if \(isShareLinkSession\(\)\)/.test(ux) &&
    /Con il link condiviso resti nel viaggio/.test(ux) &&
    /shareLock/.test(account)
);

if (process.exitCode) process.exit(1);
console.log("home-viaggi-share-lock 20261124b ok");
