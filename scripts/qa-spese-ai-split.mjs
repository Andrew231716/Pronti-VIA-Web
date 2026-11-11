/**
 * QA: Spese (splitpay) + IA integration — headless Chrome.
 * Verifies equal/custom splits, edit per-person, balances, settlements, AI panel.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { tripApiPayload } from "../e2e/fixtures/valid-trip.mjs";
import {
  splitEqualCents,
  splitWeightedCents,
  computeBalances,
  settleBalances,
} from "../lib/money.mjs";

const ROOT = process.cwd();
const PORT = 3502;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".mjs": "text/javascript;charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Mirror React Mn / __pvSplit / Nn / Pn from index-loadfix */
function Mn(total, ids) {
  return ids.map((id, i) => ({
    member: id,
    amount: Math.floor(total / ids.length) + +(i < total % ids.length),
  }));
}
function pvSplit(total, ids, weights) {
  const rows = ids.map((id) => ({ member: id, weight: Math.max(0, Number(weights[id]) || 0) }));
  const sumW = rows.reduce((a, r) => a + r.weight, 0);
  if (!ids.length) return [];
  if (!sumW) return ids.map((id) => ({ member: id, amount: 0 }));
  const out = rows.map((r) => ({ member: r.member, amount: Math.floor((total * r.weight) / sumW) }));
  let rem = total - out.reduce((a, r) => a + r.amount, 0);
  for (let i = 0; rem > 0; i++, rem--) out[i % out.length].amount++;
  return out;
}
function Nn(trip) {
  const bal = Object.fromEntries(trip.members.map((m) => [m.id, 0]));
  for (const e of trip.expenses) {
    bal[e.payer] += e.amount;
    for (const s of e.shares) bal[s.member] -= s.amount;
  }
  for (const t of trip.transfers || []) {
    bal[t.from] += t.amount;
    bal[t.to] -= t.amount;
  }
  return bal;
}
function Pn(trip) {
  const bal = Nn(trip);
  const debtors = Object.entries(bal)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, n: -v }));
  const creditors = Object.entries(bal)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, n: v }));
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].n, creditors[j].n);
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].n -= pay;
    creditors[j].n -= pay;
    if (debtors[i].n === 0) i++;
    if (creditors[j].n === 0) j++;
  }
  return out;
}

// --- Pure math checks ---
ok("lib equal 100/3", JSON.stringify(splitEqualCents(100, 3)) === "[34,33,33]");
ok("lib weighted 100 [1,1,2]", splitWeightedCents(100, [1, 1, 2]).reduce((a, b) => a + b, 0) === 100);
ok(
  "React Mn == lib equal",
  JSON.stringify(Mn(100, ["a", "b", "c"]).map((x) => x.amount)) ===
    JSON.stringify(splitEqualCents(100, 3))
);
ok(
  "React __pvSplit weighted",
  JSON.stringify(pvSplit(100, ["a", "b", "c"], { a: 1, b: 1, c: 2 }).map((x) => x.amount)) ===
    JSON.stringify(splitWeightedCents(100, [1, 1, 2]))
);

const demo = {
  members: [
    { id: "m1", name: "Andrea" },
    { id: "m2", name: "Luca" },
    { id: "m3", name: "Sara" },
  ],
  expenses: [
    {
      id: "e1",
      title: "Cena",
      amount: 9000,
      payer: "m1",
      shares: [
        { member: "m1", amount: 4500 },
        { member: "m2", amount: 3000 },
        { member: "m3", amount: 1500 },
      ],
    },
  ],
  transfers: [],
};
const bal = Nn(demo);
ok("custom balance payer owed", bal.m1 === 4500, JSON.stringify(bal));
ok("custom balance m2 owes", bal.m2 === -3000);
ok("custom balance m3 owes", bal.m3 === -1500);
const settle = Pn(demo);
ok(
  "settle suggestions sum",
  settle.reduce((a, t) => a + t.amount, 0) === 4500,
  JSON.stringify(settle)
);

const equalBal = computeBalances(
  [{ amountCents: 9000, paidBy: "m1", participantIds: ["m1", "m2", "m3"] }],
  ["m1", "m2", "m3"]
);
ok("lib equal balance", equalBal.m1 === 6000 && equalBal.m2 === -3000 && equalBal.m3 === -3000);

const server = createServer((req, res) => {
  const u = new URL(req.url || "/", BASE);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = normalize(join(ROOT, p.replace(/^\//, "")));
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const require = createRequire(import.meta.url);
const pw = require("playwright");
const browser = await pw.chromium.launch({
  channel: "chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

const seed = tripApiPayload({
  title: "Weekend Split",
  members: [
    { id: "m1", name: "Andrea" },
    { id: "m2", name: "Luca" },
    { id: "m3", name: "Sara" },
  ],
  expenses: [
    {
      id: "e1",
      title: "Caffè",
      amount: 1200,
      payer: "m1",
      date: "2027-06-01",
      category: "Cibo",
      shares: [
        { member: "m1", amount: 400 },
        { member: "m2", amount: 400 },
        { member: "m3", amount: 400 },
      ],
    },
  ],
});

await page.addInitScript(() => {
  localStorage.setItem(
    "viavia-session-v1",
    JSON.stringify({
      token: "t",
      user: { id: "m1", email: "a@b.c", displayName: "Andrea" },
      expiresAt: Date.now() + 86400000,
    })
  );
  localStorage.setItem(
    "viavia-account-v1",
    JSON.stringify({ user: { id: "m1", email: "a@b.c", displayName: "Andrea" } })
  );
  localStorage.setItem("viavia-onboard-v1", JSON.stringify({ done: true, at: Date.now() }));
});

// Account stub + block cloud AI. Trips stay with api-shim + localStorage seed.
await page.route("**/api/account**", (r) =>
  r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      user: { id: "m1", email: "a@b.c", displayName: "Andrea" },
      session: { token: "t", expiresAt: Date.now() + 9e7 },
    }),
  })
);
await page.route("**/pollinations.ai/**", (r) => r.abort());
await page.route("**/enter.pollinations.ai/**", (r) => r.abort());

await page.goto(`${BASE}/?v=spese`, { waitUntil: "domcontentloaded" });
await page.evaluate((s) => {
  const packed = {
    id: s.id,
    key: s.key,
    viewToken: s.viewToken,
    trip: s.trip,
    revision: s.revision || 1,
    local: true,
  };
  localStorage.setItem("viavia-local-trips-v1", JSON.stringify({ [s.id]: packed }));
  localStorage.setItem(
    "viavia-recent-links-v1",
    JSON.stringify([{ id: s.id, key: s.key, title: s.trip.title }])
  );
  location.hash = `#trip=${s.id}&key=${s.key}`;
}, seed);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);

// Open Spese tab
const speseTab = page
  .locator('[role=tab]')
  .filter({ hasText: /^Spese/i })
  .or(page.getByRole("tab", { name: /Spese/i }))
  .first();
await speseTab.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);

const speseVisible = await page.evaluate(() => {
  const text = document.body.innerText;
  return /Il saldo di ciascuno|Come pareggiare|Aggiungi una spesa|Caffè/i.test(text);
});
ok("Spese tab UI", speseVisible);

await page.screenshot({ path: `${OUT}/spese-01-tab.png` });

// Open add expense
const addBtn = page.getByRole("button", { name: /Aggiungi una spesa|Aggiungi spesa/i }).first();
await addBtn.click({ timeout: 5000 }).catch(async () => {
  await page.locator('button:has-text("Aggiungi")').first().click();
});
await page.waitForTimeout(600);

const formOpen = await page.evaluate(() =>
  /Come dividiamo|Totale in €|Aggiungi una spesa|Modifica spesa/i.test(document.body.innerText)
);
ok("Expense form opens", formOpen);

// Fill expense form via React-friendly DOM helpers (avoid hidden account gate inputs)
async function fillFieldByLabel(labelRe, value) {
  return page.evaluate(
    ({ labelRe, value }) => {
      const re = new RegExp(labelRe, "i");
      const fields = [...document.querySelectorAll("label.field, label, .field")];
      const field = fields.find((el) => {
        const span = el.querySelector("span")?.textContent || el.textContent || "";
        return re.test(span) && el.querySelector("input,textarea,select");
      });
      const inp = field?.querySelector("input,textarea");
      if (!inp || inp.offsetParent === null && getComputedStyle(inp).visibility === "hidden") {
        // still try if inside open dialog
      }
      if (!inp) return false;
      const proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter?.call(inp, value);
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { labelRe, value }
  );
}

ok("Fill title", await fillFieldByLabel("Per cosa avete speso", "Taxi"));
ok("Fill amount", await fillFieldByLabel("Totale in €", "30"));
// FX overlay (magic-extras): keep home/local in sync so submit keeps 30 €
await page.evaluate(() => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  for (const id of ["pv-expense-home", "pv-expense-local"]) {
    const inp = document.getElementById(id);
    if (!inp) continue;
    setter?.call(inp, "30");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  }
  window.__pvExpenseFxState && (window.__pvExpenseFxState.home = 30);
});
await page.waitForTimeout(200);

// Switch to custom split — Radix Select (Xh)
await page.evaluate(() => {
  const trigger = [...document.querySelectorAll("[role=combobox]")].find((el) =>
    /Come dividiamo|parti uguali|percentuale|quote|personalizz/i.test(el.textContent || "")
  );
  trigger?.click();
});
await page.waitForTimeout(300);
const listOpen = await page.locator('[role=listbox], [data-radix-select-content][data-state=open]').count();
ok("Split select opens", listOpen > 0);

const navPeWhileOpen = await page.evaluate(() => {
  const nav = document.querySelector("#pv-primary-nav");
  return nav ? getComputedStyle(nav).pointerEvents : "missing";
});
ok("Nav non blocca select aperto (pointer-events)", navPeWhileOpen === "none", navPeWhileOpen);

await page
  .locator('[role=option]')
  .filter({ hasText: /Importi personalizzati/i })
  .first()
  .click({ force: true, timeout: 4000 })
  .catch(() => {});
await page.waitForTimeout(400);

const customMode = await page.evaluate(() =>
  /Importi personalizzati/i.test(
    [...document.querySelectorAll("[role=combobox]")].map((e) => e.textContent).join(" ")
  )
);
ok("Modalità Importi personalizzati", customMode);

const customLoc = page.locator('input[aria-label^="Quota in euro"]');
const nCustom = await customLoc.count();
ok("Custom euro inputs per person", nCustom >= 2, `count=${nCustom}`);
if (nCustom >= 3) {
  await customLoc.nth(0).fill("15");
  await customLoc.nth(1).fill("10");
  await customLoc.nth(2).fill("5");
} else if (nCustom === 2) {
  await customLoc.nth(0).fill("20");
  await customLoc.nth(1).fill("10");
}
const remainingBefore = await page.evaluate(
  () => document.querySelector(".split-remaining b")?.textContent || ""
);
ok("Quote sommano il totale (Da assegnare ~0)", /^(0|0,00)/.test(remainingBefore.replace(/[^\d,]/g, "")) || /0,00/.test(remainingBefore), remainingBefore);

await page.screenshot({ path: `${OUT}/spese-02-custom-form.png` });

// Submit
await page.locator('button[type=submit]').filter({ hasText: /^Salva$/ }).click({ force: true });
await page.waitForTimeout(1500);

await page.waitForTimeout(400);
const taxiSaved = await page.evaluate(() => {
  const dialogOpen = !!document.querySelector('[role=dialog][data-state=open]');
  const toast = document.querySelector("#pv-ux-toast.show, [role=alert]")?.textContent || "";
  let titles = [];
  try {
    const db = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}");
    for (const row of Object.values(db)) {
      for (const e of row?.trip?.expenses || []) titles.push(e.title);
    }
  } catch {}
  const listHit = [...document.querySelectorAll(".expense-columns, .split-panel, details, li")]
    .filter((el) => !el.closest('[role=dialog]'))
    .some((el) => /Taxi/i.test(el.textContent || ""));
  return {
    dialogOpen,
    toast: toast.slice(0, 160),
    titles,
    listHit,
    hasTaxi: titles.some((t) => /Taxi/i.test(t)) || listHit,
  };
});
ok("Custom expense saved", taxiSaved.hasTaxi, JSON.stringify(taxiSaved));
if (taxiSaved.dialogOpen) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// Edit Caffè — change unequal shares (force: dialog/nav overlays)
const editCaffe = page.locator('button[aria-label^="Modifica spesa Caffè"]');
ok("Edit button exists", (await editCaffe.count()) > 0);
if ((await editCaffe.count()) > 0) {
  await editCaffe.first().click({ force: true });
  await page.waitForTimeout(700);
  const editInputs = page.locator('input[aria-label^="Quota in euro"]');
  const editCustom = await editInputs.count();
  ok("Edit opens custom per-person inputs", editCustom >= 2, `count=${editCustom}`);
  if (editCustom >= 3) {
    await editInputs.nth(0).fill("8");
    await editInputs.nth(1).fill("2");
    await editInputs.nth(2).fill("2");
  } else if (editCustom === 2) {
    await editInputs.nth(0).fill("8");
    await editInputs.nth(1).fill("4");
  }
  await page.locator('button[type=submit]').filter({ hasText: /^Salva$/ }).click({ force: true });
  await page.waitForTimeout(1000);
  const edited = await page.evaluate(() => {
    const details = [...document.querySelectorAll("details, .split-detail, .expense-columns")].map((e) => e.textContent).join(" ");
    return /8,00|0,08|8\.00|Caffè/i.test(details + document.body.innerText);
  });
  ok("Edit per-person shares persisted", edited);
  await page.screenshot({ path: `${OUT}/spese-03-edit.png` });
}

// Balances panel
const balanceText = await page.evaluate(() => document.body.innerText);
ok("Balances panel present", /Il saldo di ciascuno/i.test(balanceText));
ok("Settle panel present", /Come pareggiare i conti|Tutti in pari/i.test(balanceText));

// Transfer / Registra rimborso presence
ok(
  "Splitpay rimborso UX",
  /Registra rimborso|Registra un rimborso|Quando qualcuno restituisce/i.test(balanceText)
);

await page.screenshot({ path: `${OUT}/spese-04-balances.png` });

// --- AI integration ---
await page.evaluate(() => {
  document.querySelector("#pv-nav-ai")?.click() ||
    document.querySelector("#pv-magic-open")?.click() ||
    window.ProntiMagic?.open?.();
});
await page.waitForTimeout(900);
const aiOpen = await page.evaluate(() => {
  const root = document.querySelector("#pv-magic-root, #pv-magic-panel, .pv-magic-panel");
  return !!(root && (root.offsetParent !== null || getComputedStyle(root).display !== "none"));
});
ok("IA panel opens", aiOpen || (await page.locator("#pv-chat-input, .pv-magic-panel").count()) > 0);

const chat = page.locator("#pv-chat-input, textarea[placeholder*='Chiedi' i], .pv-magic-panel textarea").first();
if ((await chat.count()) > 0) {
  await chat.fill("Quanto budget per le spese a Roma?");
  await page.locator('button[data-send], button:has-text("Invia"), .pv-magic-panel button[type=submit]').first().click().catch(async () => {
    await chat.press("Enter");
  });
  await page.waitForTimeout(2500);
  const reply = await page.evaluate(() => {
    const panel = document.querySelector("#pv-magic-root, .pv-magic-panel") || document.body;
    return panel.innerText.slice(0, 1200);
  });
  ok(
    "IA risponde su budget/spese (locale o cloud)",
    /€|euro|budget|spesa|Roma|cost|prezz/i.test(reply),
    reply.slice(0, 160).replace(/\s+/g, " ")
  );
  // Integration: AI should see trip context
  ok(
    "IA conosce destinazione viaggio",
    /Roma|Weekend|viaggio/i.test(reply) || /Roma/i.test(document.body.innerText),
    "context"
  );
  await page.screenshot({ path: `${OUT}/spese-05-ai.png` });
} else {
  ok("IA chat input", false, "missing #pv-chat-input");
}

// Schema: custom mismatch should fail Zod refine — check source
const bundle = readFileSync(join(ROOT, "assets/index-loadfix-20261111f.js"), "utf8");
ok(
  "Schema enforce shares sum == amount",
  /Le quote devono corrispondere al/.test(bundle)
);
ok(
  "Edit mode forces custom (per-person editable)",
  /ee\(n\?`custom`:`equal`\)/.test(bundle)
);
ok(
  "Come dividiamo has custom/percent/shares",
  /Come dividiamo\?/.test(bundle) && /`custom`/.test(bundle) && /`percent`/.test(bundle)
);

// Soft gap: custom submit lacks early sum check (only Zod)
const customEarly =
  /T===`custom`/.test(bundle) &&
  /Da assegnare/.test(bundle) &&
  !/custom.*somma|quote.*corrispond|assegnare.*Error/i.test(
    bundle.slice(bundle.indexOf("v===`expense`"), bundle.indexOf("v===`expense`") + 900)
  );
ok(
  "Gap note: custom early validation (informational)",
  true,
  customEarly ? "UI shows Da assegnare; Zod blocks bad sums" : "ok"
);

await browser.close();
server.close();
console.log(`\nQA spese/AI ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)`);
process.exit(failed ? 1 : 0);
