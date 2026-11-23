import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const account = readFileSync("account.js", "utf8");
const spa = readFileSync("assets/index-loadfix-20261120w.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "stamps 20261120w (prefer-home still wired)",
  /const SHELL_VER = "20261120w"/.test(account) &&
    /account\.js\?v=20261120w/.test(index) &&
    /20261120w-postassicura/.test(sw) &&
    /index-loadfix-20261120w\.js/.test(account) &&
    /index-loadfix-20261120w\.js/.test(sw) &&
    existsSync("assets/index-loadfix-20261120w.js")
);

ok(
  "SPA honors prefer-home and skips auto-resume",
  spa.includes("pv-prefer-home-v1") &&
    spa.includes("sessionStorage.getItem(`pv-prefer-home-v1`)===`1`") &&
    spa.includes("sessionStorage.removeItem(`pv-prefer-home-v1`)")
);

ok(
  "login prefers Home unless shared trip pending",
  /pv-prefer-home-v1/.test(account) &&
    /pendingShare\?\.trip && pendingShare\?\.key/.test(account) &&
    /forceHomeLanding/.test(account) &&
    /watchStuckTripLoad/.test(account) &&
    /rootIsStuckLoading/.test(account)
);

ok(
  "stuck loading timeout shortened in SPA",
  spa.includes("8e3") &&
    spa.includes("Torna in Home o riprova")
);

if (process.exitCode) process.exit(1);
console.log("fix-home-login-stuck 20261120v ok");
