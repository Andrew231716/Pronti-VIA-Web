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
ok("index loads expense-splitwise stamp", /expense-splitwise-20261111o\.js/.test(index));
ok("asset file exists", existsSync("assets/expense-splitwise-20261111o.js"));
ok("source file exists", existsSync("expense-splitwise.js"));

const src = readFileSync("expense-splitwise.js", "utf8");
ok("board id", src.includes("pv-splitwise-board"));
ok("settle one-tap", src.includes('data-sw="settle"') || src.includes("recordSettlement"));
ok("activity hook", src.includes("installActivityHook") && src.includes("expenseActivity"));
ok("filters", src.includes("data-sw-filter"));
ok("comments", src.includes("expenseComments"));
const activeBundle = readFileSync("assets/index-loadfix-20261111f.js", "utf8");
ok("expense rows and notes share the same stable ID",
  activeBundle.includes('className:`expense-row`,"data-expense-id":e.id') &&
  src.includes("expense.id === li.dataset.expenseId")
);

const sw = readFileSync("sw.js", "utf8");
ok("sw precaches splitwise", /expense-splitwise-20261111o\.js/.test(sw));

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

// Verify the actual script's fetch wrapper and observer with an open Spese tab.
const { runInNewContext } = await import("node:vm");
let timers = 0;
let observer;
const location = { hash: "#trip=alpha&key=test" };
const board = { isConnected: true, innerHTML: "" };
const document = {
  documentElement: {},
  getElementById: (id) => id === "pv-splitwise-board" ? board : {},
  querySelector: () => ({ textContent: "Spese" }),
  querySelectorAll: () => [],
};
let responses = [];
const window = { fetch: async () => responses.shift() ?? { ok: true } };
runInNewContext(src, {
  window, document, location, URLSearchParams,
  MutationObserver: class {
    constructor(callback) { observer = callback; }
    observe() {}
  },
  addEventListener() {},
  clearTimeout() {},
  setTimeout() { timers++; },
});

const initialTimers = timers;
await window.fetch("/api/trips/alpha");
await window.fetch("/api/trips/beta", { method: "PUT" });
ok("reads and writes to other trips never schedule a refresh", timers === initialTimers);
await window.fetch("/api/trips/alpha", { method: "PUT" });
ok("a successful write to the active trip schedules a refresh", timers === initialTimers + 1);
observer([{ target: { nodeType: 1, closest: () => board }, addedNodes: [{ nodeType: 3 }], removedNodes: [] }]);
ok("updates inside the expenses board never schedule a refresh", timers === initialTimers + 1);

const trip = {
  members: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  expenses: [{ amount: 1000, payer: "a", shares: [{ member: "b", amount: 1000 }] }],
};
responses.push({ ok: true, json: async () => ({ trip, canEdit: false }) });
await window.__pvSplitwise.renderBoard(true);
ok("read-only guests see refresh but no edit shortcuts", board.innerHTML.includes('data-sw="refresh"') &&
  !/data-sw="(?:settle|goto-add|goto-transfer)"/.test(board.innerHTML));
responses.push({ ok: false, json: async () => ({ error: "Temporaneamente non disponibile" }) });
await window.__pvSplitwise.renderBoard(true);
ok("a failed request leaves a retry button", board.innerHTML.includes("Riprova"));
if (failed) process.exitCode = 1;
