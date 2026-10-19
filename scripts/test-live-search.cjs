const puppeteer = require("puppeteer");
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const server = spawn("python3", ["-m", "http.server", "8766", "--bind", "127.0.0.1"], {
    cwd: "/workspace",
    stdio: "ignore",
  });
  await sleep(800);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  try {
    await page.goto("http://127.0.0.1:8766/index.html?v=20261019g", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#pv-account-gate");
    await page.click('[data-mode="register"]');
    await page.type("#pv-username", "live" + Date.now().toString(36).slice(-5));
    await page.type("#pv-password", "test1234");
    await page.click(".pv-account-submit");
    await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"));
    await page.click(".pv-prev-launch");
    await page.waitForSelector("#pv-preventivo-root.open");
    for (const [sel, val] of [
      ['input[data-param="destination"]', "Lisbona"],
      ['input[data-param="title"]', "Weekend Lisbona"],
      ['input[data-param="airportIn"]', "LIS"],
      ['input[data-param="start"]', "2026-11-15"],
      ['input[data-param="end"]', "2026-11-22"],
      ['input[data-param="travelers"]', "2"],
    ]) {
      await page.$eval(
        sel,
        (el, v) => {
          el.value = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        },
        val
      );
    }

    await page.click('[data-section="flights"]');
    await page.click('[data-act="search-flights"]');
    await page.waitForSelector("[data-apply-flight]", { timeout: 90000 });
    const flightCount = await page.$$eval("[data-apply-flight]", (els) => els.length);
    await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/live-flights-results.png" });
    await page.click("[data-apply-flight]");

    await page.click('[data-section="stays"]');
    await page.click('[data-act="search-stays"]');
    await page.waitForSelector("[data-apply-stay]", { timeout: 120000 });
    const stayCount = await page.$$eval("[data-apply-stay]", (els) => els.length);
    await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/live-stays-results.png" });
    await page.click("[data-apply-stay]");
    const status = await page.$eval(".pv-status", (el) => el.textContent);

    console.log(JSON.stringify({ flightCount, stayCount, status }));
    if (!flightCount || !stayCount) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
