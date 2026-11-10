#!/usr/bin/env node
/**
 * Deep functional + visual QA for current shell (20261107l).
 * Captures issues + screenshots under /opt/cursor/artifacts/screenshots.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { tripApiPayload } from "../e2e/fixtures/valid-trip.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = Number(process.env.PV_QA_PORT || 3490);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.PV_QA_OUT || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

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

const issues = [];
function issue(sev, area, msg, detail = "") {
  issues.push({ sev, area, msg, detail: String(detail || "").slice(0, 400) });
  console.log(`${sev.toUpperCase()}  [${area}] ${msg}${detail ? " — " + String(detail).slice(0, 160) : ""}`);
}
function ok(area, msg) {
  console.log(`PASS  [${area}] ${msg}`);
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

async function installMocks(page, seed) {
  await page.route("**/api/account**", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        user: { id: "m1", email: "andrea@example.com", displayName: "Andrea" },
        session: { token: "qa-token", expiresAt: Date.now() + 86400000 },
      }),
    })
  );
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
    if (method === "PUT" || method === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          ...seed,
          trip: body.trip || seed.trip,
          revision: (Number(body.revision) || seed.revision) + 1,
          local: false,
          source: "store",
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(seed),
    });
  });
  await page.route("**/api/**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function boot(page, seed) {
  await page.addInitScript((s) => {
    localStorage.setItem(
      "viavia-session-v1",
      JSON.stringify({
        token: "qa-token",
        user: { id: "m1", email: "andrea@example.com", displayName: "Andrea" },
        expiresAt: Date.now() + 86400000,
      })
    );
    localStorage.setItem(
      "viavia-account-v1",
      JSON.stringify({ user: { id: "m1", email: "andrea@example.com", displayName: "Andrea" } })
    );
    localStorage.setItem("viavia-onboard-v1", JSON.stringify({ done: true, at: Date.now() }));
    localStorage.setItem(
      "viavia-recent-links-v1",
      JSON.stringify([{ id: s.id, key: s.key, title: s.trip.title }])
    );
    localStorage.setItem(
      "viavia-local-trips-v1",
      JSON.stringify({ [s.id]: { ...s, local: true, source: "local", durable: false } })
    );
  }, seed);
  await installMocks(page, seed);
}

function overlaps(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function auditViewport(browser, label, viewport, isMobile) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: isMobile ? 2 : 1,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  const seed = { ...tripApiPayload({ title: "QA Roma" }), local: true, source: "local", durable: false };
  await boot(page, seed);

  await page.goto(`${BASE}/?v=qa-${label}#trip=e2e-trip-1&key=e2e-key-1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"), {
    timeout: 20000,
  }).catch(() => {});
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    document.querySelectorAll(".pv-ux-modal .pv-ux-close, [data-ux-close]").forEach((el) => el.click());
    document.getElementById("pv-ux-toast")?.classList.remove("show");
  });
  await page.waitForTimeout(500);

  // Stamp
  const scripts = await page.evaluate(() =>
    [...document.scripts].map((s) => s.src).filter((s) => /2026110/.test(s))
  );
  if (!scripts.some((s) => /pv-platform-20261110b/.test(s))) {
    issue("high", label, "pv-platform stamp non 20261107l", JSON.stringify(scripts));
  } else ok(label, "stamp platform 20261110b");
  if (!scripts.some((s) => /magic-extras-20261107l/.test(s))) {
    issue("high", label, "magic stamp non 20261107l", JSON.stringify(scripts));
  } else ok(label, "stamp magic 20261107l");

  // Primary nav
  const nav = await page.evaluate(() => {
    const n = document.getElementById("pv-primary-nav");
    const items = [...(n?.querySelectorAll("button, a") || [])].map((el) => (el.textContent || "").trim());
    const r = n?.getBoundingClientRect();
    return {
      present: Boolean(n),
      items,
      bottom: r ? Math.round(r.bottom) : null,
      vh: window.innerHeight,
      clipped: r ? r.bottom > window.innerHeight + 2 || r.top < 0 : null,
    };
  });
  if (!nav.present) issue("high", label, "primary nav assente");
  else ok(label, `primary nav: ${nav.items.join(" · ")}`);
  if (nav.clipped) issue("med", label, "primary nav fuori viewport", JSON.stringify(nav));

  // Overlaps: FAB vs nav, magic vs nav, toast vs banner
  const geom = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    };
    return {
      nav: box(document.getElementById("pv-primary-nav")),
      magic: box(document.querySelector("#pv-magic-open")),
      hubFab: box(document.getElementById("pv-plat-fab")),
      preventivo: box(document.querySelector("#pv-prev-fab, [data-pv-prev-fab], .pv-prev-fab")),
      banner: box(document.getElementById("pv-local-only-banner")),
      toast: box(document.getElementById("pv-ux-toast")?.classList.contains("show") ? document.getElementById("pv-ux-toast") : null),
      chip: box(document.getElementById("pv-account-chip")),
      bodyCrash: /shares is not iterable|transfers is not iterable/i.test(document.body.innerText || ""),
      hasTrip: /QA Roma|Roma|Colosseo/i.test(document.body.innerText || ""),
      bannerText: (document.getElementById("pv-local-only-banner")?.innerText || "").slice(0, 120),
      bannerCompact: document.getElementById("pv-local-only-banner")?.classList.contains("pv-banner-compact"),
    };
  });

  if (geom.bodyCrash) issue("high", label, "crash shares/transfers in UI");
  if (!geom.hasTrip) issue("high", label, "contenuto viaggio assente / schermo bianco", geom.bannerText);
  else ok(label, "contenuto viaggio presente");

  if (geom.magic && geom.nav && overlaps(geom.magic, geom.nav)) {
    issue("high", label, "bacchetta sovrappone primary nav", JSON.stringify({ magic: geom.magic, nav: geom.nav }));
  }
  if (geom.hubFab && geom.nav && overlaps(geom.hubFab, geom.nav)) {
    issue("med", label, "Hub FAB sovrappone primary nav");
  }
  if (geom.magic) {
    // With primary nav, magic FAB should usually be hidden
    issue("med", label, "bacchetta ancora visibile con primary nav (dovrebbe essere nascosta / solo nav IA)", JSON.stringify(geom.magic));
  } else ok(label, "bacchetta nascosta con primary nav");

  if (geom.banner && !geom.bannerCompact) {
    issue("med", label, "banner locale senza classe compact", geom.bannerText);
  } else if (geom.banner) ok(label, `banner compact: ${geom.bannerText.slice(0, 60)}`);

  await page.screenshot({ path: join(OUT, `qa-${label}-01-trip.png`) });

  // Hub groups + all tabs
  await page.evaluate(() => {
    if (typeof window.ProntiPlatform?.open === "function") window.ProntiPlatform.open();
    else document.getElementById("pv-hub-nav")?.click();
  });
  await page.waitForTimeout(700);
  const hub = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const panel = document.getElementById("pv-plat-panel");
    const groups = [...panel?.querySelectorAll("[data-plat-group]") || []].map((b) => (b.textContent || "").trim());
    const tabs = [...panel?.querySelectorAll("[data-tab]") || []].map((b) => b.dataset.tab);
    const visited = [];
    for (const btn of [...panel?.querySelectorAll("[data-tab]") || []]) {
      btn.click();
      await wait(260);
      visited.push({
        tab: btn.dataset.tab,
        on: btn.classList.contains("on"),
        len: (document.getElementById("pv-plat-body")?.innerText || "").trim().length,
        entering: panel?.classList.contains("pv-plat-entering"),
      });
    }
    document.querySelector('#pv-plat-panel [data-plat-group="trip"]')?.click();
    await wait(200);
    const orgVisible = [...panel?.querySelectorAll("[data-tab]") || []]
      .filter((b) => !b.hidden)
      .map((b) => b.dataset.tab);
    return {
      open: panel?.classList.contains("open"),
      title: /HUB/i.test(panel?.innerText || ""),
      groups,
      tabs,
      visited,
      orgVisible,
      panelBottom: panel?.getBoundingClientRect().bottom,
      vh: window.innerHeight,
    };
  });
  if (!hub.open) issue("high", label, "Hub non si apre");
  else ok(label, `Hub open groups=${hub.groups.join("/")}`);
  if (!hub.groups.includes("Collabora") || !hub.groups.includes("Organizza")) {
    issue("high", label, "Hub groups Collabora/Organizza mancanti", JSON.stringify(hub.groups));
  }
  const emptyTabs = (hub.visited || []).filter((v) => v.len < 8);
  if (emptyTabs.length) issue("high", label, "Hub tab senza contenuto", JSON.stringify(emptyTabs));
  else ok(label, `Hub ${hub.visited?.length || 0} tab con contenuto`);
  if (hub.panelBottom > hub.vh + 40) {
    issue("med", label, "Hub panel tagliato in basso dalla viewport", JSON.stringify({ bottom: hub.panelBottom, vh: hub.vh }));
  }
  await page.screenshot({ path: join(OUT, `qa-${label}-02-hub.png`) });

  // Close hub, open Profilo/Menu
  await page.evaluate(() => document.querySelector("#pv-plat-panel [data-plat=close]")?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    if (typeof window.__pvOpenAccountMenu === "function") window.__pvOpenAccountMenu();
    else document.getElementById("pv-nav-profile")?.click() || document.getElementById("pv-account-menu")?.click();
  });
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => {
    const sheet = document.querySelector(".pv-ux-modal.pv-open .pv-ux-sheet, .pv-ux-modal .pv-ux-sheet");
    const acts = [...document.querySelectorAll(".pv-ux-modal button[data-ux]")].map((b) => b.getAttribute("data-ux"));
    const r = sheet?.getBoundingClientRect();
    const nav = document.getElementById("pv-primary-nav")?.getBoundingClientRect();
    return {
      open: Boolean(sheet),
      acts,
      text: (sheet?.innerText || "").slice(0, 200),
      sheetBottom: r?.bottom,
      navTop: nav?.top,
      overlapsNav: r && nav ? !(r.bottom <= nav.top || r.top >= nav.bottom) : false,
    };
  });
  if (!menu.open) issue("high", label, "Menu/Profilo non si apre");
  else ok(label, `Menu acts=${menu.acts.slice(0, 8).join(",")}`);
  for (const need of ["hub", "invite", "checklist", "more"]) {
    if (!menu.acts.includes(need)) issue("med", label, `Menu manca azione ${need}`, JSON.stringify(menu.acts));
  }
  if (menu.overlapsNav) issue("med", label, "Menu sheet sovrappone primary nav (padding insufficiente?)");
  await page.screenshot({ path: join(OUT, `qa-${label}-03-menu.png`) });

  // IA via nav
  await page.evaluate(() => {
    document.querySelectorAll(".pv-ux-modal .pv-ux-close, [data-ux-close]").forEach((el) => el.click());
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    if (typeof window.__pvNavAi === "function") window.__pvNavAi();
    else document.getElementById("pv-nav-ai")?.click();
  });
  await page.waitForTimeout(800);
  const magic = await page.evaluate(() => {
    const panel = document.querySelector("#pv-magic-panel");
    const tabs = [...document.querySelectorAll("#pv-magic-panel [data-tab]")].map((b) => (b.textContent || "").trim());
    return {
      open: Boolean(document.body.classList.contains("pv-magic-open") && panel && !panel.hidden),
      tabs,
      hasLingua: tabs.some((t) => /lingua/i.test(t)),
    };
  });
  if (!magic.open) issue("high", label, "IA non si apre dalla nav");
  else ok(label, `IA open tabs=${magic.tabs.join(",")}`);
  if (!magic.hasLingua) issue("med", label, "tab Lingua assente in IA");
  await page.screenshot({ path: join(OUT, `qa-${label}-04-ia.png`) });

  // Home cards (leave trip)
  await page.evaluate(() => {
    document.querySelector("#pv-magic-close, [data-magic-close]")?.click();
    document.body.classList.remove("pv-magic-open");
  });
  await page.goto(`${BASE}/?v=qa-home-${label}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    document.getElementById("pv-account-gate")?.remove();
    document.querySelectorAll(".pv-ux-modal").forEach((m) => m.remove());
    let host = document.querySelector(".recent-trips");
    if (!host) {
      host = document.createElement("div");
      host.className = "recent-trips";
      const wrap = document.createElement("section");
      wrap.style.cssText = "padding:16px;max-width:480px;margin:0 auto";
      wrap.innerHTML = `<h1 style="font:700 1.3rem inherit;color:#0f343a">I tuoi viaggi</h1>`;
      wrap.appendChild(host);
      (document.querySelector("main") || document.body).prepend(wrap);
    }
    host.innerHTML = `
      <a class="booking-card" href="#trip=t1&key=k1"><strong>Weekend Roma</strong><div>2026-12-12 · Italia</div></a>
      <a class="booking-card" href="#trip=t2&key=k2"><strong>Lisbona</strong><div>2025-06-01 · Portogallo</div></a>`;
  });
  await page.waitForTimeout(1600);
  const home = await page.evaluate(() => ({
    seg: Boolean(document.querySelector(".pv-home-seg")),
    cards: document.querySelectorAll(".pv-trip-card").length,
    thumbs: document.querySelectorAll(".pv-trip-thumb").length,
    labels: [...document.querySelectorAll(".pv-home-seg button")].map((b) => (b.textContent || "").trim()),
  }));
  if (!home.seg || home.cards < 2) {
    issue("med", label, "Home cards non enhanced", JSON.stringify(home));
  } else ok(label, `Home cards ok seg=${home.labels.join("/")}`);
  await page.screenshot({ path: join(OUT, `qa-${label}-05-home.png`) });

  // Page errors
  const blocking = errors.filter((e) => /shares is not iterable|transfers is not iterable|is not defined|Cannot read/i.test(e));
  if (blocking.length) issue("high", label, "pageerror bloccanti", blocking.slice(0, 3).join(" | "));
  else if (errors.length) issue("low", label, "pageerror non bloccanti", errors.slice(0, 3).join(" | "));
  else ok(label, "nessun pageerror");

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
    await auditViewport(browser, "mobile", { width: 390, height: 844 }, true);
    await auditViewport(browser, "desktop", { width: 1280, height: 800 }, false);
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  const high = issues.filter((i) => i.sev === "high").length;
  const med = issues.filter((i) => i.sev === "med").length;
  writeFileSync(join(OUT, "qa-audit-ui.json"), JSON.stringify({ issues, high, med }, null, 2));
  console.log(`\nQA issues: ${issues.length} (high=${high}, med=${med})`);
  process.exit(high ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
