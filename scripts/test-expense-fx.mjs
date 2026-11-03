/**
 * Smoke: dual-currency expense form + auto local FX (ETB).
 * Run: node scripts/test-expense-fx.mjs
 */
import puppeteer from "puppeteer";

const BASE = process.env.PV_BASE || "http://127.0.0.1:3000/index.html";
const results = [];

function ok(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  await page.goto(`${BASE}?v=fx-e2e`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await wait(800);

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "viavia-account-v1",
      JSON.stringify({
        token: "local:fx-e2e",
        user: { username: "fx-e2e", displayName: "FX Tester" },
        remembered: true,
        savedAt: new Date().toISOString(),
      })
    );
    localStorage.setItem(
      "viavia-home-currency-v1",
      JSON.stringify({ code: "EUR", name: "Euro" })
    );
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await wait(2500);

  const tripInfo = await page.evaluate(async () => {
    const trip = {
      title: "Etiopia Addis",
      destination: "Addis Abeba, Etiopia",
      start: "2027-03-01",
      end: "2027-03-10",
      budget: 0,
      members: [
        { id: "m1", name: "FX Tester" },
        { id: "m2", name: "Compagno" },
      ],
      stops: [],
      bookings: [],
      expenses: [],
      transfers: [],
      checklist: [],
      notes: "",
    };
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  });
  ok(
    "create Ethiopia trip",
    tripInfo.ok && tripInfo.data?.id,
    JSON.stringify({ status: tripInfo.status, id: tripInfo.data?.id })
  );

  const tripId = tripInfo.data?.id;
  const tripKey = tripInfo.data?.key;
  if (!tripId || !tripKey) throw new Error("no trip id/key");

  await page.goto(
    `${BASE}?v=fx-e2e2#trip=${encodeURIComponent(tripId)}&key=${encodeURIComponent(tripKey)}`,
    { waitUntil: "domcontentloaded", timeout: 45000 }
  );

  // Wait until trip chrome is ready (tabs exist).
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() =>
      [...document.querySelectorAll("[role=tab],button")].some((el) =>
        /Spese di gruppo/.test(el.textContent || "")
      )
    );
    if (ready) break;
    await wait(300);
  }

  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => /ho capito/i.test(b.textContent || ""))
      ?.click();
    document.querySelector("#pv-account-gate")?.remove();
  });
  await wait(400);

  let onSpese = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.evaluate(() => {
      const target =
        [...document.querySelectorAll("[role=tab]")].find((el) =>
          (el.textContent || "").includes("Spese di gruppo")
        ) ||
        [...document.querySelectorAll("button")].find(
          (b) => (b.textContent || "").trim() === "Spese di gruppo"
        );
      if (!target) return;
      target.scrollIntoView({ block: "center" });
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      target.click();
    });
    await wait(1000);
    onSpese = await page.evaluate(
      () =>
        Boolean(document.querySelector(".money-stats")) ||
        /CONTI CHIARI|Chi ha pagato/i.test(document.body.innerText)
    );
    if (onSpese) break;
  }
  ok("open Spese di gruppo tab", onSpese);

  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => /Aggiungi spesa/i.test(b.textContent || ""))
      ?.click();
  });
  await wait(800);

  let fxUi = null;
  for (let i = 0; i < 24; i++) {
    await wait(400);
    fxUi = await page.evaluate(() => {
      const box = document.querySelector(".pv-expense-fx");
      const local = document.querySelector("#pv-expense-local");
      const home = document.querySelector("#pv-expense-home");
      const detect = document.querySelector("#pv-expense-fx-detect");
      const calc = document.querySelector(".pv-fx-calc");
      const native = [...document.querySelectorAll("label.field")].find((label) => {
        const span = label.querySelector(":scope > span");
        return span && /^Totale in/i.test((span.textContent || "").trim());
      })?.querySelector("input");
      return {
        hasLocal: Boolean(local),
        hasHome: Boolean(home),
        detectText: detect?.textContent || "",
        calcMeta: calc?.querySelector("#pv-fx-meta")?.textContent || "",
        calcHome: calc?.querySelector("#pv-fx-home-currency")?.value || "",
        hint: box?.querySelector("#pv-expense-fx-hint")?.textContent || "",
        nativeHidden: Boolean(
          document.querySelector("label.field.pv-expense-amount-native-hidden")
        ),
        hasNative: Boolean(native),
      };
    });
    if (fxUi.hasLocal && /ETB|Birr/i.test(fxUi.detectText + fxUi.calcMeta + fxUi.hint)) break;
  }

  ok("expense dual inputs present", fxUi.hasLocal && fxUi.hasHome, JSON.stringify(fxUi));
  ok(
    "auto-detect ETB",
    /ETB|Birr/i.test(fxUi.detectText + fxUi.calcMeta),
    JSON.stringify(fxUi)
  );
  ok("home currency picker", fxUi.calcHome === "EUR", JSON.stringify(fxUi));

  const conv = await page.evaluate(() => {
    const local = document.querySelector("#pv-expense-local");
    const home = document.querySelector("#pv-expense-home");
    const native = [...document.querySelectorAll("label.field")].find((label) => {
      const span = label.querySelector(":scope > span");
      return span && /^Totale in/i.test((span.textContent || "").trim());
    })?.querySelector("input");
    if (!local || !home) return { ok: false, reason: "missing inputs" };
    local.focus();
    local.value = "1845";
    local.dispatchEvent(new Event("input", { bubbles: true }));
    const homeVal = home.value;
    const nativeVal = native?.value || "";
    const hint = document.querySelector("#pv-expense-fx-hint")?.textContent || "";
    const parseIt = (raw) =>
      Number(
        String(raw || "")
          .replace(/\s/g, "")
          .replace(/\./g, "")
          .replace(",", ".")
      );
    return {
      ok: true,
      homeVal,
      nativeVal,
      hint,
      homeNum: parseIt(homeVal),
      nativeNum: Number(String(nativeVal).replace(",", ".")),
    };
  });

  ok(
    "local→home conversion",
    conv.ok && Number.isFinite(conv.homeNum) && conv.homeNum > 5 && conv.homeNum < 20,
    JSON.stringify(conv)
  );
  ok(
    "native EUR synced for submit",
    conv.ok && Number.isFinite(conv.nativeNum) && conv.nativeNum > 5 && conv.nativeNum < 20,
    JSON.stringify(conv)
  );

  const back = await page.evaluate(() => {
    const local = document.querySelector("#pv-expense-local");
    const home = document.querySelector("#pv-expense-home");
    if (!local || !home || home.readOnly) return { ok: false, reason: "readonly-or-missing" };
    home.focus();
    home.value = "10";
    home.dispatchEvent(new Event("input", { bubbles: true }));
    const localVal = local.value;
    const n = Number(
      String(localVal)
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    );
    return { ok: true, localVal, n };
  });
  ok("home→local conversion", back.ok && back.n > 1000, JSON.stringify(back));
} catch (err) {
  ok("runtime", false, String(err?.stack || err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
