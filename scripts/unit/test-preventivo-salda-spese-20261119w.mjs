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
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "personal payment ledger helpers",
  /function listPersonalPaymentEntries/.test(magic) &&
    /function totalPersonalPaidCents/.test(magic) &&
    /function personalBudgetRemaining/.test(magic) &&
    /function refreshPersonalBudgetUi/.test(magic) &&
    /function syncBudgetCardWithPersonal/.test(magic) &&
    /function renderPreventivoPersonalLedger/.test(magic)
);

ok(
  "Salda/Salva refreshes personal expenses + budget remaining",
  /refreshPersonalBudgetUi\(auth\.id\)/.test(magic) &&
    /personalBudgetRemaining\(auth\.id\)/.test(magic) &&
    /Restano \$\{formatEuro\(budgetInfo\.remaining\)\} sul budget privato/.test(magic) &&
    /Spese personali da preventivo/.test(magic)
);

ok(
  "Spese personali list shows budget residual",
  /budget privato \$\{formatEuro\(budget\)\}/.test(magic) &&
    /syncBudgetCardWithPersonal\(authForBudget\.id\)/.test(magic)
);

ok(
  "stamps",
  /magic-extras-20261120a\.js/.test(index) &&
    /20261120a-iafile/.test(sw) &&
    /const SHELL_VER = "20261120a"/.test(account) &&
    existsSync("assets/magic-extras-20261120a.js") &&
    /dataset\.pvReady = "20261120a"/.test(magic)
);

if (process.exitCode) process.exit(process.exitCode);
console.log("all ok");
