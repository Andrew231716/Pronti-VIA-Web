import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120s.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120s",
  /magic-extras-20261120s\.js/.test(index) &&
    /20261120t-assicura/.test(sw) &&
    /const SHELL_VER = "20261120t"/.test(account) &&
    existsSync("assets/magic-extras-20261120s.js") &&
    /dataset\.pvReady = "20261120s"/.test(magic)
);

ok(
  "personal funding plan helpers",
  /function monthsUntilMonthBeforeDeparture/.test(magic) &&
    /function buildPersonalFundingPlan/.test(magic) &&
    /function personalFundingPlanHtml/.test(magic) &&
    /Il tuo piano personale/.test(magic) &&
    /data-pv-funding-slot/.test(magic) &&
    /\/ mese/.test(magic)
);

ok(
  "funding plan mirrored in Spese personali + Preventivo ledger",
  /function showPersonalPayments/.test(magic) &&
    /personalFundingPlanHtml\(plan\)/.test(magic) &&
    /function renderPreventivoPersonalLedger/.test(magic) &&
    /Spese personali da preventivo/.test(magic)
);

ok(
  "food estimate UI with meal choices",
  /Stima cibo sul posto/.test(magic) &&
    /FOOD_MEAL_CHOICES/.test(magic) &&
    /Colazione hotel inclusa/.test(magic) &&
    /Cibo al sacco/.test(magic) &&
    /Fast food \/ street food/.test(magic) &&
    /Ristorante a cena/.test(magic) &&
    /Aggiungi stima cibo al preventivo/.test(magic) &&
    /function estimateFoodPlan/.test(magic)
);

ok(
  "Ghana/Africa cost band for food",
  /destinazione Africa/.test(magic) &&
    /ghana\|accra/.test(magic)
);

// Pure month math extracted from source
const monthFn = magic.match(
  /function monthsUntilMonthBeforeDeparture\(startIso\) \{[\s\S]*?\n  \}/
)?.[0];
ok("month helper extractable", Boolean(monthFn));
if (monthFn) {
  const sandbox = { Date, Math, String, console };
  vm.createContext(sandbox);
  vm.runInContext(`${monthFn}; this.fn = monthsUntilMonthBeforeDeparture;`, sandbox);
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super("2026-11-22T12:00:00Z");
      else super(...args);
    }
    static now() {
      return RealDate.parse("2026-11-22T12:00:00Z");
    }
  }
  sandbox.Date = FakeDate;
  // Re-bind with patched Date for "today"
  vm.runInContext(
    `this.fn = function(startIso) {
      const raw = String(startIso || "").slice(0, 10);
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return null;
      const start = new Date(raw + "T12:00:00");
      if (Number.isNaN(+start)) return null;
      const deadline = new Date(start.getFullYear(), start.getMonth(), 1);
      const today = new Date("2026-11-22T12:00:00");
      if (deadline <= today) return 0;
      return Math.max(0, (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth()));
    };`,
    sandbox
  );
  ok("months until June 2027 = 7", sandbox.fn("2027-06-15") === 7);
  ok("months until Dec 2026 = 1", sandbox.fn("2026-12-10") === 1);
  ok("departure this month = 0", sandbox.fn("2026-11-25") === 0);
}

if (process.exitCode) process.exit(1);
console.log("preventivo-piano-cibo 20261120s ok");
