import puppeteer from "puppeteer";

const BASE = process.env.PV_BASE || "http://127.0.0.1:3000/index.html";
const results = [];
const pageErrors = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickTab(page, labelRe) {
  const handles = await page.$$('[role=tab]');
  for (const h of handles) {
    const t = (await page.evaluate((el) => el.textContent || "", h)).trim();
    if (labelRe.test(t)) {
      const box = await h.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await h.click({ delay: 20 });
      }
      await wait(1200);
      return t;
    }
  }
  // scroll tabs into view and retry
  await page.evaluate(() => {
    const tabs = document.querySelector('[role=tablist]');
    tabs?.scrollIntoView({ block: "center" });
  });
  await wait(300);
  for (const h of await page.$$('[role=tab]')) {
    const t = (await page.evaluate((el) => el.textContent || "", h)).trim();
    if (labelRe.test(t)) {
      await h.evaluate((el) => el.click());
      await wait(1200);
      return t;
    }
  }
  return null;
}

const browser = await puppeteer.launch({
  headless: "new",
  protocolTimeout: 60000,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1280, height: 900 });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push("console:" + msg.text());
  });

  await page.goto(`${BASE}?v=as-tabs`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await wait(600);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "viavia-account-v1",
      JSON.stringify({
        token: "local:as-tabs",
        user: { username: "as-tabs", displayName: "Suite Tester" },
        remembered: true,
        savedAt: new Date().toISOString(),
      })
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await wait(2000);

  const tripInfo = await page.evaluate(async () => {
    const trip = {
      title: "Suite Etiopia",
      destination: "Addis Abeba, Etiopia",
      start: "2027-04-01",
      end: "2027-04-12",
      budget: 150000,
      members: [
        { id: "m1", name: "Suite Tester" },
        { id: "m2", name: "Compagno" },
      ],
      stops: [
        {
          id: crypto.randomUUID(),
          title: "Mercato Merkato",
          day: "Giorno 1",
          notes: "",
          category: "Cultura",
          address: "Addis",
          lat: 9.03,
          lng: 38.74,
        },
      ],
      bookings: [],
      expenses: [],
      transfers: [],
      checklist: [{ id: crypto.randomUUID(), title: "Passaporto", done: false }],
      notes: "Note di prova @Suite",
    };
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    const data = await res.json();
    return { ok: res.ok, id: data.id, key: data.key };
  });
  ok("create trip", tripInfo.ok && tripInfo.id);

  await page.goto(`${BASE}?v=as-tabs#trip=${tripInfo.id}&key=${tripInfo.key}`, {
    waitUntil: "domcontentloaded",
  });
  await wait(3500);

  ok("app-suite loaded", await page.evaluate(() => Boolean(window.__pvAppSuite?.ver)));
  ok("portal host outside root", await page.evaluate(() => {
    const p = document.getElementById("pv-as-portal");
    const root = document.getElementById("root");
    return Boolean(p && root && !root.contains(p));
  }));

  const checks = [
    [/itinerario/i, "#pv-as-panel-itinerary", "Itinerario panel"],
    [/esplora|luoghi|posti/i, "#pv-as-panel-places", "Esplora panel"],
    [/prenotazioni/i, "#pv-as-panel-bookings", "Prenotazioni panel"],
    [/documenti/i, "#pv-as-panel-docs", "Documenti panel"],
    [/valigia|checklist/i, "#pv-as-panel-pack", "Valigia panel"],
    [/^note$/i, "#pv-as-panel-notes", "Note panel"],
    [/spese/i, "#pv-es-portal .pv-es-bar", "Spese toolbar portal"],
    [/preventivo/i, "#pv-as-panel-preventivo", "Preventivo panel"],
  ];

  for (const [re, sel, name] of checks) {
    const beforeErr = pageErrors.length;
    const tab = await clickTab(page, re);
    await wait(900);
    const alive = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll("[role=tab]")];
      return {
        count: tabs.length,
        active: (document.querySelector('[role=tab][data-state=active], [role=tab][aria-selected="true"]')?.textContent || "").trim(),
      };
    });
    const visible = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      if (el.hidden) return false;
      const st = getComputedStyle(el);
      return st.display !== "none" && st.visibility !== "hidden";
    }, sel);
    const newErrs = pageErrors.slice(beforeErr);
    ok(
      name,
      Boolean(tab) && alive.count > 0 && visible && !newErrs.some((e) => /length|undefined|Cannot read/i.test(e)),
      `tab=${tab || "?"} active=${alive.active} tabs=${alive.count} visible=${visible} errs=${newErrs.join(" | ").slice(0, 120)}`
    );
  }

  // final tabs still alive after full sweep
  const finalTabs = await page.evaluate(() => document.querySelectorAll("[role=tab]").length);
  ok("tabs alive after sweep", finalTabs >= 5, `count=${finalTabs}`);
  const fatal = pageErrors.filter((e) => /Cannot read properties of undefined \(reading 'length'\)/i.test(e));
  ok("no React length crash", fatal.length === 0, fatal.join(" | ").slice(0, 160));
  const realPageErrors = pageErrors.filter(
    (e) => !/^console:Failed to load resource/i.test(e) && !/404 \(Not Found\)/i.test(e)
  );
  ok(
    "no page exceptions",
    realPageErrors.length === 0,
    realPageErrors.slice(0, 5).join(" || ").slice(0, 240)
  );

  // Interactive smoke: booking status + doc meta in portal dock
  await clickTab(page, /prenotazioni/i);
  await wait(1000);
  const bookingOk = await page.evaluate(() => {
    const title = document.querySelector("#pv-as-book-title");
    const status = document.querySelector("#pv-as-book-status");
    const save = document.querySelector("#pv-as-book-save");
    if (!title || !status || !save) return false;
    title.value = "Hotel Test";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    status.value = "confirmed";
    status.dispatchEvent(new Event("change", { bubbles: true }));
    save.click();
    return /Hotel Test/i.test(document.querySelector("#pv-as-book-list")?.textContent || "");
  });
  ok("booking status save", bookingOk);

  await clickTab(page, /documenti/i);
  await wait(1000);
  const docOk = await page.evaluate(() => {
    const title = document.querySelector("#pv-as-doc-title");
    const add = document.querySelector("#pv-as-doc-add");
    if (!title || !add) return false;
    title.value = "Passaporto";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    add.click();
    return /Passaporto/i.test(document.querySelector("#pv-as-doc-list")?.textContent || "");
  });
  ok("doc meta save", docOk);

  console.log("\n--- summary ---");
  const failed = results.filter((r) => !r.pass);
  console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
} finally {
  await browser.close();
}
