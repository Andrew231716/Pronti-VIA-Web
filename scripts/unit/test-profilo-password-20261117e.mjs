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
const css = readFileSync("account.css", "utf8");
const netlify = readFileSync("netlify/functions/account.mjs", "utf8");
const recovery = readFileSync("api/recovery-account.mjs", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok("profile password form", /renderPasswordChangeBlock/.test(ux) && /pv-change-password-form/.test(ux));
ok("wire change form", /wirePasswordChangeForm/.test(ux) && /__pvChangePassword/.test(ux));
ok("show/hide reveal", /data-pv-reveal/.test(ux) && /data-pv-reveal/.test(account) && /pv-pass-reveal/.test(css));
ok("reveal outside label", /pv-pass-field/.test(ux) && /stopPropagation/.test(account) && /is-revealed/.test(account));
ok("reveal stacks above input", /z-index:2/.test(ux) && /isolation:isolate/.test(ux));
ok("saved password status card", /pv-pass-status-card/.test(ux) && /Password impostata/.test(ux) && /non si può rileggere/i.test(ux));
ok("change behind details", /pv-pass-change/.test(ux) && /Cambia password/.test(ux) && /Riscrivi la password attuale/.test(ux));
ok("reveal label Vedi", /data-pv-reveal-idle="Vedi"/.test(ux) && /data-pv-reveal-idle="Vedi"/.test(account));
ok("styles stamped once", /const STYLE_VER = "20261119j"/.test(ux) && /dataset\.pvReady === STYLE_VER/.test(ux));
ok("shell updates without forced reload", !/pv-shell-reloaded/.test(account) && /pv-sw-checked/.test(account));
ok("changePassword helper", /async function changePassword/.test(account) && /__pvChangePassword/.test(account));
ok("gate password wrap", /pv-pass-wrap/.test(account) && /aria-controls="pv-password"/.test(account));
ok("netlify change-password", /action === "change-password"/.test(netlify) && /currentPassword/.test(netlify));
ok("recovery change-password", /action === "change-password"/.test(recovery) && /Password attuale non corretta/.test(recovery));
ok(
  "stamps",
  /ux-suite-20261119j\.js/.test(index) &&
    /account\.js\?v=20261119b/.test(index) &&
    /account\.css\?v=20261118b/.test(index) &&
    existsSync("assets/ux-suite-20261119j.js")
);
ok("sw", /20261119b/.test(sw) && /ux-suite-20261119j\.js/.test(sw) && /account\.js\?v=20261119b/.test(sw));


if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
