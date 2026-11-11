#!/usr/bin/env node
/**
 * Smoke: Splitwise board sidecar wired + activity diff helper shape.
 */
import { readFileSync, existsSync } from "node:fs";
import { computeShareBalances, settleBalances } from "../../lib/money.mjs";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const index = readFileSync("index.html", "utf8");
ok("index loads expense-splitwise stamp", /expense-splitwise-20261111d\.js/.test(index));
ok("asset file exists", existsSync("assets/expense-splitwise-20261111d.js"));
ok("source file exists", existsSync("expense-splitwise.js"));

const src = readFileSync("expense-splitwise.js", "utf8");
ok("board id", src.includes("pv-splitwise-board"));
ok("settle one-tap", src.includes('data-sw="settle"') || src.includes("recordSettlement"));
ok("activity hook", src.includes("installActivityHook") && src.includes("expenseActivity"));
ok("filters", src.includes("data-sw-filter"));
ok("comments", src.includes("expenseComments"));

const sw = readFileSync("sw.js", "utf8");
ok("sw precaches splitwise", /expense-splitwise-20261111d\.js/.test(sw));

const plat = readFileSync("pv-platform.js", "utf8");
ok("Hub Numeri shows saldi", /Spese condivise · saldi/.test(plat));
ok("platform exports computeShareBalances", /computeShareBalances/.test(plat));

const bal = computeShareBalances({
  members: [{ id: "a" }, { id: "b" }],
  expenses: [
    {
      amount: 1000,
      payer: "a",
      shares: [
        { member: "a", amount: 500 },
        { member: "b", amount: 500 },
      ],
    },
  ],
  transfers: [],
});
ok("share bal a +500", bal.a === 500);
ok("share bal b -500", bal.b === -500);
ok("settle one hop", settleBalances(bal)[0]?.amountCents === 500);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
