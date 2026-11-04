#!/usr/bin/env node
/**
 * Deep UX verification for redesign 20261104g.
 * Mobile + desktop: chrome, Menu actions, Hub tabs, bacchetta, trip content.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { tripApiPayload } from "../e2e/fixtures/valid-trip.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = Number(process.env.PV_VERIFY_PORT || 3465);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.PV_VERIFY_OUT || "/opt/cursor/artifacts/screenshots";
const results = [];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

function ok(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail: String(detail || "") });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

function startStatic() {
  const server = createServer((req, res) => {
    try {
      const u = new URL(req.url || "/", BASE);
      let path = decodeURIComponent(u.pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(ROOT, path.replace(/^\//, "")));
      if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(readFileSync(file));
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

async function installAccountRoute(page) {
  await page.route("**/api/account**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        user: { id: "m1", email: "andrea@example.com", displayName: "Andrea" },
        session: { token: "verify-token", expiresAt: Date.now() + 86400000 },
      }),
    });
  });
  await page.route("**/api/trips**", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    let body = {};
    try {
      body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    } catch {
      body = {};
    }
    const base = tripApiPayload({ title: "Verifica Roma" });
    if (method === "PUT" || method === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          ...base,
          trip: body.trip || base.trip,
          revision: (Number(body.revision) || base.revision) + 1,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(base),
    });
  });
  await page.route("**/api/share**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/.netlify/functions/**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tripApiPayload({ title: "Verifica Roma" })),
    });
  });
}

async function bootTrip(page) {
  await page.addInitScript((seed) => {
    localStorage.setItem(
      "viavia-session-v1",
      JSON.stringify({
        token: "verify-token",
        user: { id: "m1", email: "andrea@example.com", displayName: "Andrea" },
        expiresAt: Date.now() + 86400000,
      })
    );
    localStorage.setItem("viavia-account-v1", JSON.stringify({
      user: { id: "m1", email: "andrea@example.com", displayName: "Andrea" },
    }));
    localStorage.setItem("viavia-onboard-v1", JSON.stringify({ done: true, at: Date.now() }));
    localStorage.setItem("viavia-recent-links-v1", JSON.stringify([{ id: seed.id, key: seed.key, title: seed.trip.title }]));
    localStorage.setItem("viavia-local-trips-v1", JSON.stringify({ [seed.id]: seed }));
  }, tripApiPayload({ title: "Verifica Roma" }));
  await installAccountRoute(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(`${BASE}/?v=verify-ux#trip=e2e-trip-1&key=e2e-key-1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Ho capito/i.test(b.textContent || ""));
    btn?.click();
    document.querySelector(".pv-ux-close")?.click();
  });
  await page.waitForTimeout(400);
  return errors;
}

async function runViewport(browser, label, viewport, isMobile) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: isMobile ? 2 : 1,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  const errors = await bootTrip(page);
  mkdirSync(OUT, { recursive: true });

  const chrome = await page.evaluate(() => {
    const hub = document.getElementById("pv-hub-nav");
    const menu = document.getElementById("pv-account-menu");
    const fab = document.getElementById("pv-plat-fab");
    const magic = document.querySelector("#pv-magic-open");
    return {
      hub: Boolean(hub),
      menu: Boolean(menu),
      hubExpanded: hub?.getAttribute("aria-expanded"),
      fabHidden: !fab || getComputedStyle(fab).display === "none",
      magic: Boolean(magic),
      bodyText: (document.body.innerText || "").slice(0, 400),
      hasColosseo: /Colosseo/i.test(document.body.innerText || ""),
      hasRoma: /Roma|Verifica Roma|E2E Roma/i.test(document.body.innerText || ""),
      scripts: [...document.scripts].map((s) => s.src).filter((s) => /20261104[ghi]|magic-extras/.test(s)),
    };
  });
  ok(`[${label}] Hub+Menu in chrome`, chrome.hub && chrome.menu, JSON.stringify({ hub: chrome.hub, menu: chrome.menu, fabHidden: chrome.fabHidden }));
  ok(`[${label}] FAB nascosto`, chrome.fabHidden);
  ok(`[${label}] Stamp 20261104i + magic`, chrome.scripts.some((s) => /pv-platform-20261104i/.test(s)) && chrome.scripts.some((s) => /magic-extras-20261104e/.test(s)), JSON.stringify(chrome.scripts));
  ok(`[${label}] Contenuto viaggio (non bianco)`, chrome.hasColosseo || chrome.hasRoma, chrome.bodyText.slice(0, 160));
  ok(`[${label}] Nessun shares/transfers crash`, !errors.some((e) => /shares is not iterable|transfers is not iterable/i.test(e)), errors.slice(0, 3).join(" | "));

  await page.screenshot({ path: join(OUT, `verify-${label}-01-trip.png`) });

  // Menu categories + open Hub from menu
  await page.evaluate(() => {
    if (typeof window.__pvOpenAccountMenu === "function") window.__pvOpenAccountMenu();
    else document.getElementById("pv-account-menu")?.click();
  });
  await page.waitForTimeout(700);
  const menuCheck = await page.evaluate(() => {
    const acts = [...document.querySelectorAll(".pv-ux-modal.pv-open button[data-ux], .pv-ux-modal button[data-ux]")].map((b) =>
      b.getAttribute("data-ux")
    );
    const sheet = document.querySelector(".pv-ux-modal.pv-open .pv-ux-sheet, .pv-ux-modal .pv-ux-sheet");
    const t = sheet?.innerText || "";
    return {
      azioni: acts.includes("section-tools") || acts.includes("search") || /Azioni rapide/i.test(t),
      organizza: acts.includes("companions") && acts.includes("invite") && acts.includes("checklist"),
      soldi: acts.includes("compare"),
      collabora: acts.includes("hub"),
      altro: acts.includes("more"),
      account: acts.includes("logout"),
      acts,
    };
  });
  ok(
    `[${label}] Menu categorie complete`,
    menuCheck.azioni && menuCheck.organizza && menuCheck.soldi && menuCheck.collabora && menuCheck.altro && menuCheck.account,
    JSON.stringify(menuCheck)
  );
  await page.screenshot({ path: join(OUT, `verify-${label}-02-menu.png`) });

  // Open Hub via menu action
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".pv-ux-modal button[data-ux]")].find((b) => b.getAttribute("data-ux") === "hub");
    btn?.click();
  });
  await page.waitForTimeout(700);
  const hubFromMenu = await page.evaluate(() => {
    const panel = document.getElementById("pv-plat-panel");
    return {
      open: panel?.classList.contains("open"),
      title: /HUB · Collaborazione|Hub · Collabora/i.test(panel?.innerText || ""),
      tabs: [...panel?.querySelectorAll("[data-tab]") || []].map((b) => b.dataset.tab),
    };
  });
  ok(`[${label}] Menu → Apri Hub`, hubFromMenu.open && hubFromMenu.title && hubFromMenu.tabs.length >= 7, JSON.stringify(hubFromMenu));

  // Visit every Hub tab
  const hubVisit = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    for (const btn of [...document.querySelectorAll("#pv-plat-panel [data-tab]")]) {
      btn.click();
      await wait(280);
      out.push({
        tab: btn.dataset.tab,
        on: btn.classList.contains("on"),
        len: (document.getElementById("pv-plat-body")?.innerText || "").trim().length,
        entering: document.getElementById("pv-plat-panel")?.classList.contains("pv-plat-entering"),
      });
    }
    return out;
  });
  ok(
    `[${label}] Hub tab tutte con contenuto`,
    hubVisit.length >= 7 && hubVisit.every((t) => t.len > 8 && !t.entering),
    JSON.stringify(hubVisit)
  );
  await page.screenshot({ path: join(OUT, `verify-${label}-03-hub.png`) });

  // Close hub, open bacchetta
  await page.evaluate(() => document.querySelector("#pv-plat-panel [data-plat=close]")?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    if (typeof window.__pvNavAi === "function") window.__pvNavAi();
    else {
      const m = document.querySelector("#pv-magic-open");
      if (m) {
        m.style.display = "inline-flex";
        m.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      } else document.getElementById("pv-nav-ai")?.click();
    }
  });
  await page.waitForTimeout(700);
  const magic = await page.evaluate(() => {
    const panel = document.querySelector("#pv-magic-panel");
    const tabs = [...document.querySelectorAll("#pv-magic-panel [data-tab]")].map((b) => (b.textContent || "").trim());
    return {
      open: Boolean(document.body.classList.contains("pv-magic-open") && panel && !panel.hidden),
      tabs,
      hasLingua: tabs.some((t) => /lingua/i.test(t)),
      aiNav: Boolean(document.getElementById("pv-nav-ai")),
    };
  });
  ok(`[${label}] Bacchetta + tab Lingua`, magic.open && magic.hasLingua && magic.aiNav, JSON.stringify(magic));
  await page.screenshot({ path: join(OUT, `verify-${label}-04-magic.png`) });

  // Hub toggle integrity
  await page.evaluate(() => {
    document.querySelector("#pv-magic-close, [data-magic-close]")?.click();
    document.body.classList.remove("pv-magic-open");
  });
  await page.waitForTimeout(200);
  const toggle = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = document.getElementById("pv-hub-nav");
    btn?.click();
    await wait(350);
    const open1 = document.getElementById("pv-plat-panel")?.classList.contains("open");
    btn?.click();
    await wait(350);
    const open2 = document.getElementById("pv-plat-panel")?.classList.contains("open");
    return { bound: btn?.dataset?.pvHubBound === "1", open1, open2 };
  });
  ok(`[${label}] Hub open→close`, toggle.bound && toggle.open1 === true && toggle.open2 === false, JSON.stringify(toggle));

  async function openMenuAction(act) {
    await page.evaluate(() => {
      document.querySelector("#pv-plat-panel [data-plat=close]")?.click();
      document.querySelectorAll(".pv-ux-modal .pv-ux-close, .pv-ux-modal [data-ux-close]").forEach((el) => el.click());
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      if (typeof window.__pvOpenAccountMenu === "function") window.__pvOpenAccountMenu();
      else document.getElementById("pv-account-menu")?.click();
    });
    await page.waitForTimeout(500);
    return page.evaluate((a) => {
      const btn = document.querySelector(`.pv-ux-modal button[data-ux="${a}"]`);
      if (!btn) return { clicked: false, acts: [...document.querySelectorAll(".pv-ux-modal button[data-ux]")].map((b) => b.getAttribute("data-ux")) };
      btn.click();
      return { clicked: true };
    }, act);
  }

  // Menu action: search
  let opened = await openMenuAction("search");
  await page.waitForTimeout(500);
  let search = await page.evaluate(() => /Cerca nel viaggio|#pv-ux-search-input/i.test(document.body.innerText || "") || Boolean(document.getElementById("pv-ux-search-input")));
  ok(`[${label}] Menu → Cerca`, opened.clicked && search, JSON.stringify(opened));

  // Menu action: invite
  opened = await openMenuAction("invite");
  await page.waitForTimeout(700);
  const invite = await page.evaluate(() => {
    const t = document.querySelector(".pv-ux-modal.pv-open .pv-ux-sheet, .pv-ux-modal .pv-ux-sheet")?.innerText || document.body.innerText || "";
    return /invito|codice|6 caratteri|condivid/i.test(t);
  });
  ok(`[${label}] Menu → Invita`, opened.clicked && invite, JSON.stringify(opened));

  // Menu action: checklist
  opened = await openMenuAction("checklist");
  await page.waitForTimeout(500);
  const checklist = await page.evaluate(() => /checklist|partenza|Passaporto|promemoria/i.test(document.body.innerText || ""));
  ok(`[${label}] Menu → Checklist`, opened.clicked && checklist, JSON.stringify(opened));

  // Menu action: compare / more
  opened = await openMenuAction("compare");
  await page.waitForTimeout(500);
  const compare = await page.evaluate(() => /preventivo|spese|budget/i.test(document.body.innerText || ""));
  ok(`[${label}] Menu → Preventivo e spese`, opened.clicked && compare, JSON.stringify(opened));

  opened = await openMenuAction("more");
  await page.waitForTimeout(700);
  const more = await page.evaluate(() => {
    const sheet = document.querySelector(".pv-ux-modal.pv-open .pv-ux-sheet, .pv-ux-modal .pv-ux-sheet")?.innerText || "";
    const body = document.body.innerText || "";
    return /Attività|Template|Versioni|Export|Altri strumenti/i.test(sheet || body);
  });
  ok(`[${label}] Menu → Altri strumenti`, opened.clicked && more, JSON.stringify({ ...opened, more }));

  await context.close();
}

async function main() {
  const require = createRequire(import.meta.url);
  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    console.error("playwright missing");
    process.exit(1);
  }
  const server = await startStatic();
  const browser = await playwright.chromium.launch({
    channel: "chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    await runViewport(browser, "mobile", { width: 390, height: 844 }, true);
    await runViewport(browser, "desktop", { width: 1280, height: 800 }, false);
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }

  const report = {
    stamp: "20261104g",
    at: new Date().toISOString(),
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "verify-ux-redesign-20261104g.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(ROOT, "docs/VERIFY_UX_20261104g.md"), `# Verifica UX redesign 20261104g

Eseguita: ${report.at} (UTC)

**Esito: ${report.failed ? "FAIL" : "PASS"}** — ${report.passed} pass / ${report.failed} fail

| Check | Esito | Dettaglio |
|---|---|---|
${results.map((r) => `| ${r.name} | ${r.pass ? "PASS" : "FAIL"} | ${String(r.detail).replace(/\|/g, "/").slice(0, 120)} |`).join("\n")}

Screenshot in artifacts: \`verify-mobile-*.png\`, \`verify-desktop-*.png\`.
`);

  console.log(`\nVERIFY ${report.passed}/${results.length} passed`);
  if (report.failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
