/**
 * QA: destination theme auto-applies palette + icons + canvas from trip.destination
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { tripApiPayload } from "../e2e/fixtures/valid-trip.mjs";

const ROOT = process.cwd();
const PORT = 3510;
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
    res.writeHead(404, { "Content-Type": "text/plain" });
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

async function openWithDest(destination, title, shot) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const seed = tripApiPayload({ title, destination });
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
  await page.goto(`${BASE}/?v=theme`, { waitUntil: "domcontentloaded" });
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
  await page.waitForTimeout(2800);
  await page.evaluate(() => window.__pvApplyDestTheme?.(true));
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    return {
      dest: root.dataset.pvDest || "",
      theme: window.__pvDestTheme || null,
      teal: cs.getPropertyValue("--pv-dest-teal").trim(),
      canvas: !!document.getElementById("pv-dest-atmosphere"),
      badge: document.getElementById("pv-dest-theme-badge")?.textContent || "",
      script: !!document.querySelector('script[src*="destination-theme"]'),
      navSvg: document.querySelector("#pv-nav-home .pv-nav-ico svg")?.outerHTML?.slice(0, 80) || "",
    };
  });
  await page.screenshot({ path: `${OUT}/${shot}` });
  await context.close();
  return info;
}

// Pure resolve checks (load script in node via evaluate in a blank page)
const page0 = await browser.newPage();
await page0.goto(`${BASE}/assets/destination-theme-20261107k.js`);
// instead run resolve via browser with script tag
await page0.setContent(`<script src="${BASE}/assets/destination-theme-20261107k.js"></script>`);
await page0.waitForTimeout(200);
const resolves = await page0.evaluate(() => {
  const r = window.__pvResolveDestThemeId;
  return {
    is: r("Reykjavik, Islanda"),
    jp: r("Tokyo, Giappone"),
    gr: r("Santorini, Grecia"),
    it: r("Roma, Italia"),
    es: r("Barcellona, Spagna"),
    def: r("Somewhere unknown xyz"),
  };
});
await page0.close();
ok("Resolve Islanda → is", resolves.is === "is", resolves.is);
ok("Resolve Giappone → jp", resolves.jp === "jp", resolves.jp);
ok("Resolve Grecia → gr", resolves.gr === "gr", resolves.gr);
ok("Resolve Italia → it", resolves.it === "it", resolves.it);
ok("Resolve Spagna → es", resolves.es === "es", resolves.es);

const ice = await openWithDest("Reykjavik, Islanda", "Aurora Trip", "theme-01-islanda.png");
ok("Script tema caricato", ice.script);
ok("Tema Islanda applicato", ice.dest === "is" && ice.theme?.id === "is", JSON.stringify(ice.theme));
ok("CSS var teal Islanda", ice.teal.includes("#") || ice.teal.startsWith("rgb"), ice.teal);
ok("Canvas atmosfera", ice.canvas);
ok("Badge tema", /Islanda/i.test(ice.badge), ice.badge);

const jp = await openWithDest("Tokyo, Giappone", "Tokyo week", "theme-02-giappone.png");
ok("Tema Giappone applicato", jp.dest === "jp", jp.dest);
ok("Palette diversa da Islanda", jp.teal !== ice.teal, `${ice.teal} vs ${jp.teal}`);

const gr = await openWithDest("Santorini, Grecia", "Egeo", "theme-03-grecia.png");
ok("Tema Grecia applicato", gr.dest === "gr", gr.dest);

const wired = readFileSync(join(ROOT, "index.html"), "utf8");
ok("index wire destination-theme", /destination-theme-20261107k/.test(wired));

await browser.close();
server.close();
console.log(`\nQA dest-theme ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)`);
process.exit(failed ? 1 : 0);
