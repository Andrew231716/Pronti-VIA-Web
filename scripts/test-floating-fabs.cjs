const puppeteer = require("puppeteer");
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const server = spawn("python3", ["-m", "http.server", "8767", "--bind", "127.0.0.1"], {
    cwd: "/workspace",
    stdio: "ignore",
  });
  await sleep(700);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  try {
    await page.goto("http://127.0.0.1:8767/index.html?v=20261019h", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#pv-account-gate");
    await page.click('[data-mode="register"]');
    await page.type("#pv-username", "fab" + Date.now().toString(36).slice(-5));
    await page.type("#pv-password", "test1234");
    await page.click(".pv-account-submit");
    await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"));
    await page.waitForSelector("#pv-magic-open", { visible: true, timeout: 15000 });
    await page.waitForSelector(".pv-prev-launch", { visible: true, timeout: 15000 });

    const labels = await page.evaluate(() => ({
      pronty: document.querySelector("#pv-magic-open")?.getAttribute("aria-label") || "",
      prev: document.querySelector(".pv-prev-launch")?.getAttribute("aria-label") || "",
      prontyRound: getComputedStyle(document.querySelector("#pv-magic-open")).borderRadius,
      prevRound: getComputedStyle(document.querySelector(".pv-prev-launch")).borderRadius,
      makeDrag: typeof window.__pvMakeDraggable,
    }));

    // Open Pronty with a tap (no drag)
    await page.click("#pv-magic-open");
    await page.waitForSelector("#pv-magic-panel:not([hidden])", { timeout: 8000 });
    const prontyTitle = await page.$eval("#pv-magic-panel h3", (el) => el.textContent);
    await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/pronty-floating.png" });
    await page.click("#pv-magic-close");

    // Open Preventivo
    await page.click(".pv-prev-launch");
    await page.waitForSelector("#pv-preventivo-root.open", { timeout: 8000 });
    const shell = await page.$eval("#pv-prev-shell", (el) => ({
      display: getComputedStyle(el).display,
      radius: getComputedStyle(el).borderRadius,
      h1: el.querySelector("h1")?.textContent,
    }));
    await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/preventivo-floating.png" });

    console.log(JSON.stringify({ labels, prontyTitle, shell }, null, 2));
    if (!/Pronty/i.test(labels.pronty) || !/Preventivo/i.test(labels.prev)) process.exitCode = 1;
    if (!/Pronty/i.test(prontyTitle)) process.exitCode = 1;
    if (labels.makeDrag !== "function") process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
