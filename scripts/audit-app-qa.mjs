/**
 * Full-app QA audit: console errors, overlaps, missing panels, screenshots.
 */
import puppeteer from "puppeteer";
import fs from "fs";

const BASE = process.env.PV_BASE || "http://127.0.0.1:8765/index.html";
const OUT = process.env.PV_AUDIT_OUT || "/opt/cursor/artifacts/screenshots/qa";
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (sev, area, msg, extra = {}) => {
  findings.push({ sev, area, msg, ...extra });
  console.log(`${sev.toUpperCase()}  [${area}] ${msg}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissChrome(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => /Ho capito/i.test(b.textContent || ""))?.click();
    document.querySelector("#pv-as-portal .pv-as-dock-title button")?.click();
    document.getElementById("pv-as-reopen")?.remove();
  });
  await wait(400);
}

async function clickTab(page, re) {
  const label = await page.evaluate((source) => {
    const rx = new RegExp(source, "i");
    const tabs = [...document.querySelectorAll("[role=tab]")];
    const t = tabs.find((el) => rx.test((el.textContent || "").trim()));
    if (!t) return null;
    t.click();
    return (t.textContent || "").trim();
  }, re.source);
  await wait(1100);
  return label;
}

async function measureOverlaps(page) {
  return page.evaluate(() => {
    const interesting = [
      "#pv-as-portal",
      "#pv-as-reopen",
      "#pv-es-portal",
      "#pv-magic-root .pv-magic-btn",
      ".pv-prev-launch",
      "#pv-local-only-banner",
      "#pv-as-cache-status",
      "#pv-ux-offline-chip",
      ".pv-home-trash-wrap",
      "[role=tablist]",
    ];
    const boxes = [];
    for (const sel of interesting) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width < 2 || r.height < 2) continue;
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
        if (el.hasAttribute("hidden")) continue;
        boxes.push({
          sel,
          text: (el.textContent || "").trim().slice(0, 40),
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          right: r.right,
          bottom: r.bottom,
        });
      }
    }
    const overlaps = [];
    const intersects = (a, b) =>
      !(a.right <= b.x + 2 || b.right <= a.x + 2 || a.bottom <= b.y + 2 || b.bottom <= a.y + 2);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.sel === b.sel) continue;
        // tabs overlapping themselves ok; portal+reopen expected mutually exclusive
        if ((a.sel === "#pv-as-portal" && b.sel === "#pv-as-reopen") || (b.sel === "#pv-as-portal" && a.sel === "#pv-as-reopen"))
          continue;
        if (intersects(a, b)) {
          const area =
            Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
          if (area > 80) overlaps.push({ a: a.sel, b: b.sel, area: Math.round(area), at: `${a.text} × ${b.text}` });
        }
      }
    }
    // elements overflowing viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const overflow = boxes.filter((b) => b.x < -4 || b.y < -4 || b.right > vw + 4 || b.bottom > vh + 4);
    return { overlaps, overflow, boxes };
  });
}

const browser = await puppeteer.launch({
  headless: "new",
  protocolTimeout: 90000,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=390,844"],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

try {
  await page.goto(`${BASE}?v=qa-home`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await wait(2000);
  await dismissChrome(page);
  await page.screenshot({ path: `${OUT}/00-home.png` });

  // Create rich trip
  const trip = await page.evaluate(async () => {
    const t = {
      title: "QA Etiopia Completo",
      destination: "Addis Abeba, Etiopia",
      start: "2027-12-05",
      end: "2027-12-13",
      budget: 250000,
      members: [
        { id: "m1", name: "Andrea" },
        { id: "m2", name: "Sara" },
      ],
      stops: [
        {
          id: crypto.randomUUID(),
          title: "Mercato Merkato",
          day: "2027-12-05",
          time: "10:00",
          notes: "Visita mercato",
          category: "Visita",
          address: "Addis Abeba",
          lat: 9.03,
          lng: 38.74,
        },
        {
          id: crypto.randomUUID(),
          title: "Pausa pranzo",
          day: "Giorno 2",
          time: "",
          notes: "Inserita come giornata tipo",
          category: "Cibo",
          address: "",
          lat: null,
          lng: null,
        },
      ],
      bookings: [
        {
          id: crypto.randomUUID(),
          title: "Volo andata",
          type: "Volo",
          date: "2027-12-05",
          reference: "ET123",
          notes: "",
          url: "",
        },
      ],
      expenses: [
        {
          id: crypto.randomUUID(),
          title: "Cena",
          amount: 40,
          payer: "m1",
          date: "2027-12-05",
          category: "Cibo",
          shares: [
            { member: "m1", amount: 20 },
            { member: "m2", amount: 20 },
          ],
        },
      ],
      transfers: [],
      checklist: [{ id: crypto.randomUUID(), title: "Passaporto", done: false }],
      notes: "Note QA @Andrea",
    };
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    const data = await res.json();
    return { ok: res.ok, id: data.id, key: data.key, error: data.error };
  });
  if (!trip.ok) note("error", "create", `trip create failed: ${trip.error}`);
  else note("info", "create", `trip ${trip.id}`);

  await page.goto(`${BASE}?v=qa-trip#trip=${trip.id}&key=${trip.key}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await wait(4500);
  await dismissChrome(page);
  await page.screenshot({ path: `${OUT}/01-trip-home.png` });

  const repaired = await page.evaluate(async (id) => {
    const p = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    const res = await fetch(`/api/trips/${id}`, {
      headers: { Authorization: `Bearer ${p.get("key")}` },
      cache: "no-store",
    });
    const data = await res.json();
    const lunch = (data.trip?.stops || []).find((s) => s.title === "Pausa pranzo");
    return { day: lunch?.day, flag: document.documentElement.dataset.pvStopRepair || "" };
  }, trip.id);
  if (repaired.day === "Giorno 2") note("error", "itinerary", "lunch day still legacy Giorno 2");
  else note("info", "itinerary", `lunch day repaired to ${repaired.day}`);

  const tabs = [
    [/itinerario/i, "itinerario", "#pv-as-panel-itinerary"],
    [/esplora|luoghi|posti/i, "esplora", "#pv-as-panel-places"],
    [/mappa/i, "mappa", null],
    [/prenotazioni/i, "prenotazioni", "#pv-as-panel-bookings"],
    [/documenti/i, "documenti", "#pv-as-panel-docs"],
    [/valigia|checklist/i, "valigia", "#pv-as-panel-pack"],
    [/^note$/i, "note", "#pv-as-panel-notes"],
    [/spese/i, "spese", "#pv-es-portal"],
    [/preventivo/i, "preventivo", "#pv-as-panel-preventivo"],
  ];

  for (const [re, name, panelSel] of tabs) {
    const beforeErr = pageErrors.length;
    const label = await clickTab(page, re);
    await dismissChrome(page);
    await wait(600);
    if (!label && name !== "mappa") {
      // mappa may be inside itinerary / explore
      note("warn", name, "tab not found");
    }
    const layout = await measureOverlaps(page);
    for (const o of layout.overlaps) {
      note("warn", name, `overlap ${o.a} ∩ ${o.b} (${o.area}px²)`, { overlap: o });
    }
    for (const o of layout.overflow) {
      note("warn", name, `overflow ${o.sel} y=${Math.round(o.y)} bottom=${Math.round(o.bottom)}`);
    }
    if (panelSel) {
      const visible = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hasAttribute("hidden")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }, panelSel);
      // panel may be dismissed — reopen chip should exist then
      if (!visible) {
        const reopen = await page.evaluate(() => Boolean(document.getElementById("pv-as-reopen")));
        if (!reopen && name !== "spese") note("warn", name, `panel ${panelSel} not visible and no reopen chip`);
        else note("info", name, reopen ? "dock dismissed, reopen chip present" : "panel hidden");
      } else {
        note("info", name, `panel ${panelSel} visible`);
      }
    }
    // Check Invalid Date text
    const badDate = await page.evaluate(() =>
      [...document.querySelectorAll("body *")].some((el) => (el.childNodes.length === 1 || el.children.length === 0) && /Invalid Date/i.test(el.textContent || ""))
    );
    // simpler
    const hasInvalid = await page.evaluate(() => /Invalid Date/i.test(document.body.innerText || ""));
    if (hasInvalid) note("error", name, "visible 'Invalid Date' text");

    const newErrs = pageErrors.slice(beforeErr);
    for (const e of newErrs) note("error", name, `pageerror: ${e}`);

    await page.screenshot({ path: `${OUT}/tab-${name}.png` });
  }

  // Desktop width pass on itinerary
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await clickTab(page, /itinerario/i);
  await dismissChrome(page);
  await wait(800);
  const desk = await measureOverlaps(page);
  for (const o of desk.overlaps) note("warn", "desktop-itinerary", `overlap ${o.a} ∩ ${o.b} (${o.area}px²)`);
  await page.screenshot({ path: `${OUT}/desktop-itinerary.png` });

  // Home list
  await page.goto(`${BASE}?v=qa-home2`, { waitUntil: "domcontentloaded" });
  await wait(2000);
  await dismissChrome(page);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const home = await measureOverlaps(page);
  for (const o of home.overlaps) note("warn", "home", `overlap ${o.a} ∩ ${o.b}`);
  await page.screenshot({ path: `${OUT}/home-final.png` });

  // Collect remaining console errors (filter noisy)
  const noisy = /favicon|Download the React DevTools|net::ERR_/i;
  for (const e of consoleErrors.filter((t) => !noisy.test(t)).slice(0, 20)) {
    note("warn", "console", e.slice(0, 180));
  }
  for (const e of pageErrors.slice(0, 20)) note("error", "pageerror", e.slice(0, 180));
} catch (err) {
  note("error", "runner", err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const summary = {
  errors: findings.filter((f) => f.sev === "error").length,
  warns: findings.filter((f) => f.sev === "warn").length,
  infos: findings.filter((f) => f.sev === "info").length,
  findings,
};
fs.writeFileSync(`${OUT}/findings.json`, JSON.stringify(summary, null, 2));
console.log("\n=== SUMMARY ===");
console.log(`errors=${summary.errors} warns=${summary.warns} infos=${summary.infos}`);
console.log(`wrote ${OUT}/findings.json`);
process.exit(summary.errors > 0 ? 1 : 0);
