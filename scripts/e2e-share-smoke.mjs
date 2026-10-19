/**
 * Smoke: guest soft-login, local-only banner, share gate, preventivo meta.
 * Run: node scripts/e2e-share-smoke.mjs
 */
import puppeteer from "puppeteer";

const BASE = process.env.PV_BASE || "http://127.0.0.1:8765/index.html";
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
  // --- A: guest soft-login on shared hash ---
  const guest = await browser.newPage();
  await guest.goto(`${BASE}?v=e2e#trip=demo-trip&key=demo-key&s=i:e30`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await wait(1500);
  const guestState = await guest.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
    const gate = document.getElementById("pv-account-gate");
    const gateVisible = gate && getComputedStyle(gate).display !== "none" && gate.offsetParent !== null;
    return {
      username: session?.user?.username || "",
      guest: Boolean(session?.guest),
      gateVisible: Boolean(gateVisible),
      chip: Boolean(document.getElementById("pv-account-chip")),
    };
  });
  ok(
    "guest soft-login on #trip&key",
    guestState.guest || /^ospite-/.test(guestState.username),
    JSON.stringify(guestState)
  );
  ok("account gate hidden for shared link", !guestState.gateVisible, JSON.stringify(guestState));
  await guest.close();

  // --- B: register, create local trip, banner + share ---
  const page = await browser.newPage();
  await page.goto(`${BASE}?v=e2e2`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await wait(800);

  // Fill account gate if present
  const hasGate = await page.evaluate(() => Boolean(document.querySelector("#pv-account-gate, .pv-gate, [data-gate]")) || /Accedi|Registrati|username/i.test(document.body.innerText));
  if (hasGate) {
    await page.evaluate(() => {
      const user = `e2e-${Date.now().toString(36)}`;
      const pass = "test-pass-123";
      // Prefer register mode
      const modeBtn = [...document.querySelectorAll("button, a")].find((el) => /registr/i.test(el.textContent || ""));
      modeBtn?.click();
      const inputs = [...document.querySelectorAll("input")];
      const userInput = inputs.find((i) => /user|nome|email/i.test(`${i.name}${i.id}${i.placeholder}${i.type}`)) || inputs[0];
      const passInput = inputs.find((i) => i.type === "password") || inputs[1];
      if (userInput) {
        userInput.focus();
        userInput.value = user;
        userInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (passInput) {
        passInput.value = pass;
        passInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const submit = [...document.querySelectorAll("button")].find((b) =>
        /entra|accedi|registr|continua|crea account/i.test(b.textContent || "")
      );
      submit?.click();
    });
    await wait(2000);
  }

  // Force local session if gate still up
  await page.evaluate(() => {
    if (!localStorage.getItem("viavia-account-v1")) {
      const username = `e2e-${Date.now().toString(36)}`;
      localStorage.setItem(
        "viavia-account-v1",
        JSON.stringify({
          token: `local:${username}`,
          user: { username, displayName: "E2E" },
          remembered: true,
          savedAt: new Date().toISOString(),
        })
      );
      location.reload();
    }
  });
  await wait(2500);

  // Create a minimal local trip record and open it
  const tripInfo = await page.evaluate(async () => {
    const trip = {
      title: "Test Condivisione E2E",
      destination: "Islanda",
      start: "2027-02-15",
      end: "2027-02-22",
      budget: 0,
      members: [{ id: "m1", name: "E2E" }],
      stops: [{ id: "s1", title: "Reykjavík", day: "Giorno 1", notes: "arrivo", category: "Città" }],
      bookings: [],
      expenses: [],
      transfers: [],
      checklist: [],
      notes: "smoke",
      meta: {
        preventivo: {
          version: "20261019b",
          scenario: "economico",
          totals: { groupCents: 5500000, perPersonCents: 687500 },
          lines: [{ id: "l1", title: "Voli", status: "STIMA", totalCents: 2800000 }],
        },
      },
    };
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trip),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  });
  ok("create trip via /api/trips", tripInfo.ok && tripInfo.data?.id, JSON.stringify({ status: tripInfo.status, id: tripInfo.data?.id, local: tripInfo.data?.local }));

  const tripId = tripInfo.data?.id;
  const tripKey = tripInfo.data?.key;
  if (!tripId || !tripKey) throw new Error("no trip id/key");

  await page.goto(`${BASE}?v=e2e3#trip=${encodeURIComponent(tripId)}&key=${encodeURIComponent(tripKey)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await wait(2500);

  const banner = await page.evaluate(() => {
    const local = document.getElementById("pv-local-only-banner");
    const pv = document.getElementById("pv-preventivo-trip-banner");
    const isLocal = typeof window.__pvIsTripLocalOnly === "function" && window.__pvIsTripLocalOnly();
    return {
      isLocal,
      localBanner: local?.textContent || "",
      pvBanner: pv?.textContent || "",
      title: document.body.innerText.slice(0, 400),
    };
  });
  // Cloud API should clear local-only; banner only when still local.
  ok(
    "cloud trip not local-only",
    banner.isLocal === false && !banner.localBanner,
    JSON.stringify({ isLocal: banner.isLocal, localBanner: banner.localBanner.slice(0, 80) })
  );
  ok(
    "preventivo banner from trip.meta",
    /Preventivo|€|STIMA/i.test(banner.pvBanner),
    banner.pvBanner.slice(0, 120)
  );

  // Share prepare
  const share = await page.evaluate(async (id, key) => {
    const ref = await window.__pvPrepareShare(id, key);
    const has = window.__pvHasShareSnapshot?.(id, key);
    return { ref: String(ref || ""), has: Boolean(has) };
  }, tripId, tripKey);
  ok("prepare share returns s= ref", /^[nbi]:/.test(share.ref), share.ref.slice(0, 40));

  // Clipboard gate unit-check (no async clipboard permission hang)
  const gate = await page.evaluate(() => typeof navigator.clipboard?.writeText === "function");
  ok("clipboard writeText patched/available", gate);

  // Open share URL in fresh context
  const ref = share.ref;
  const shareUrl = `${BASE}?v=e2e4#trip=${encodeURIComponent(tripId)}&key=${encodeURIComponent(tripKey)}&s=${encodeURIComponent(ref)}`;
  const fresh = await browser.newPage();
  await fresh.goto(`${BASE}?v=clear`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await fresh.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await fresh.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await wait(4000);
  const opened = await fresh.evaluate((wantId) => {
    const text = document.body.innerText || "";
    const session = JSON.parse(localStorage.getItem("viavia-account-v1") || "null");
    const trips = JSON.parse(localStorage.getItem("viavia-local-trips-v1") || "{}");
    const trip = trips[wantId]?.trip || null;
    return {
      guest: Boolean(session?.guest) || /^ospite-/.test(session?.user?.username || ""),
      hasTrip: Boolean(trip),
      title: trip?.title || "",
      dest: trip?.destination || "",
      hasPreventivo: Boolean(trip?.meta?.preventivo),
      error: /Non riusciamo ad aprire/i.test(text),
      snippet: text.slice(0, 200),
    };
  }, tripId);
  ok("shared trip opens for guest", opened.hasTrip && !opened.error, JSON.stringify(opened));
  ok("shared trip keeps preventivo meta", opened.hasPreventivo, JSON.stringify({ title: opened.title, hasPreventivo: opened.hasPreventivo }));
  await fresh.close();
  await page.close();
} catch (err) {
  ok("runner", false, String(err?.stack || err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
