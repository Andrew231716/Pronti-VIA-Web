/**
 * QA: tablet + desktop chrome (nav, Hub, sheets, theme badge)
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { tripApiPayload } from "../e2e/fixtures/valid-trip.mjs";

const ROOT = process.cwd();
const PORT = 3512;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });
const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const server = createServer((req, res) => {
  const u = new URL(req.url || "/", BASE);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  if (p.startsWith("/api/")) {
    res.writeHead(404);
    res.end("static-missing");
    return;
  }
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

async function probe(viewport, label, shot) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const seed = tripApiPayload({ title: "Responsive Tour", destination: "Roma, Italia" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "viavia-session-v1",
      JSON.stringify({
        token: "t",
        user: { id: "m1", email: "a@b.c", displayName: "Andrea" },
        expiresAt: Date.now() + 9e7,
      })
    );
    localStorage.setItem(
      "viavia-account-v1",
      JSON.stringify({ user: { id: "m1", email: "a@b.c", displayName: "Andrea" } })
    );
    localStorage.setItem("viavia-onboard-v1", JSON.stringify({ done: true }));
  });
  await page.goto(`${BASE}/?v=resp`, { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => {
    localStorage.setItem(
      "viavia-local-trips-v1",
      JSON.stringify({
        [s.id]: {
          id: s.id,
          key: s.key,
          viewToken: s.viewToken,
          trip: s.trip,
          revision: 1,
          local: true,
        },
      })
    );
    location.hash = `#trip=${s.id}&key=${s.key}`;
  }, seed);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2400);
  await page.evaluate(() => window.__pvApplyDestTheme?.(true));
  await page.waitForTimeout(300);

  // Open Hub (panel is created lazily)
  await page.click("#pv-hub-nav");
  await page.waitForSelector("#pv-plat-panel.open", { timeout: 8000 });
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const nav = document.querySelector("#pv-primary-nav .pv-primary-nav-inner");
    const panel = document.getElementById("pv-plat-panel");
    const chip = document.querySelector("#pv-account-chip .pv-account-chip-main");
    const badge = document.getElementById("pv-dest-theme-badge");
    const nr = nav?.getBoundingClientRect();
    const pr = panel?.getBoundingClientRect();
    const cs = panel ? getComputedStyle(panel) : null;
    return {
      navW: Math.round(nr?.width || 0),
      navBottom: Math.round(nr?.bottom || 0),
      hubW: Math.round(pr?.width || 0),
      hubBottom: Math.round(pr?.bottom || 0),
      hubTop: Math.round(pr?.top || 0),
      hubLeft: Math.round(pr?.left || 0),
      hubTransform: cs?.transform || "",
      chipMax: chip ? getComputedStyle(chip).maxWidth : "",
      badgeMax: badge ? getComputedStyle(badge).maxWidth : "",
      dest: document.documentElement.dataset.pvDest || "",
      open: panel?.classList.contains("open"),
    };
  });

  await page.screenshot({ path: `${OUT}/${shot}` });
  await context.close();
  return { label, viewport, ...metrics };
}

const phone = await probe({ width: 390, height: 844 }, "phone", "resp-01-phone.png");
const tablet = await probe({ width: 820, height: 1180 }, "tablet", "resp-02-tablet.png");
const desktop = await probe({ width: 1440, height: 900 }, "desktop", "resp-03-desktop.png");

ok(
  "Phone Hub full-bleed sheet",
  phone.open && phone.hubW >= 300 && phone.hubW <= 400,
  JSON.stringify({ w: phone.hubW, top: phone.hubTop, left: phone.hubLeft })
);
ok(
  "Tablet Hub floating centered (~640)",
  tablet.open && tablet.hubW >= 560 && tablet.hubW <= 680 && tablet.hubLeft > 40,
  JSON.stringify({ w: tablet.hubW, left: tablet.hubLeft, top: tablet.hubTop })
);
ok(
  "Desktop Hub wider than tablet",
  desktop.open && desktop.hubW >= tablet.hubW && desktop.hubW >= 700,
  `tablet=${tablet.hubW} desktop=${desktop.hubW}`
);
ok("Desktop nav wider than phone", desktop.navW > phone.navW, `${phone.navW}→${desktop.navW}`);
ok("Tema Italia su tutti i viewport", phone.dest === "it" && tablet.dest === "it" && desktop.dest === "it");

const css = readFileSync(join(ROOT, "account.css"), "utf8");
ok("account.css ha breakpoint 768/1100", /min-width:\s*768px/.test(css) && /min-width:\s*1100px/.test(css));
const plat = readFileSync(join(ROOT, "pv-platform.js"), "utf8");
ok("Hub non ha più dock 860 conflittuale", !/inset:\s*64px 24px auto auto/.test(plat));
ok("Hub tablet floating 768", /min-width:\s*768px/.test(plat) && /translateX\(-50%\)/.test(plat));

await browser.close();
server.close();
console.log(`\nQA responsive ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)`);
process.exit(failed ? 1 : 0);
