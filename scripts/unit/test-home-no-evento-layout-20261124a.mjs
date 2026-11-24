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
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261124b",
  /STYLE_VER = "20261124b"/.test(ux) &&
    /ux-suite-20261124b\.js/.test(index) &&
    /ux-suite-20261124b\.js/.test(sw) &&
    /const SHELL_VER = "20261124b"/.test(account) &&
    existsSync("assets/ux-suite-20261124b.js") &&
    readFileSync("assets/ux-suite-20261124b.js", "utf8") === ux
);

ok(
  "home import CTA removed",
  /Home no longer shows/.test(ux) &&
    !/<strong>Crea viaggio da evento<\/strong>/.test(ux) &&
    /#pv-home-import-btn,\s*\n?\s*\.pv-home-import-card\{display:none!important\}/.test(ux)
);

ok(
  "home actions row polish",
  /function polishHomeActionsRow/.test(ux) &&
    /top-actions\.pv-home-actions/.test(ux) &&
    /run\(polishHomeActionsRow\)/.test(ux)
);

ok(
  "home Sistema menu without event create",
  !/Crea \/ importa da evento/.test(ux) &&
    /Usa «Nuovo viaggio» in Home/.test(ux)
);

if (process.exitCode) process.exit(1);
console.log("home-no-evento-layout 20261124b ok");
