#!/usr/bin/env node
/**
 * Verificato updates price; fully settled personal payments must not invent "Da saldare".
 */
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

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
  "helpers present",
  /function settledShareForDisplay/.test(magic) && /function personalPayStatusLabel/.test(magic)
);
ok(
  "spese uses settled share + saldato label",
  /settledShareForDisplay\(entry, line, travelers\)/.test(magic) &&
    /personalPayStatusLabel\(entry\.paid, share\)/.test(magic) &&
    /Saldato/.test(magic) &&
    /Verificato = prezzo confermato/.test(magic)
);

const helperSrc = magic.match(
  /function settledShareForDisplay\(entry, line, travelers\) \{[\s\S]*?\n  \}/
)?.[0];
const lineAmt = magic.match(/function lineAmount\(line\) \{[\s\S]*?\n  \}/)?.[0];
ok("helpers extractable", Boolean(helperSrc && lineAmt));

const sandbox = {
  Math,
  Number,
  console,
};
vm.runInNewContext(
  `${lineAmt}\n${helperSrc}\nthis.settledShareForDisplay = settledShareForDisplay;`,
  sandbox
);

const line = { totalCents: 120000, unitCents: 120000, qty: 1 }; // 1200 €
const travelers = 1;
const fullyPaidOld = { paid: 98700, share: 98700 }; // was fully paid at 987
ok(
  "fully paid stored share does not invent debt after price verify bump",
  sandbox.settledShareForDisplay(fullyPaidOld, line, travelers) === 98700
);
ok(
  "partial pay still uses live share",
  sandbox.settledShareForDisplay({ paid: 50000, share: 98700 }, line, travelers) === 120000
);
ok(
  "unpaid with no store uses live",
  sandbox.settledShareForDisplay({ paid: 0, share: 0 }, line, travelers) === 120000
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
