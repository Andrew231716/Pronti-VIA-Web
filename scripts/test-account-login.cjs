const puppeteer = require("puppeteer");
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const server = spawn("python3", ["-m", "http.server", "8768", "--bind", "127.0.0.1"], {
    cwd: "/workspace",
    stdio: "ignore",
  });
  await sleep(700);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const user = "andrea" + Date.now().toString(36).slice(-4);
  const pass = "prova1234";
  try {
    await page.goto("http://127.0.0.1:8768/index.html?v=20261019i", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#pv-account-gate");
    // Register
    await page.click('[data-mode="register"]');
    await page.type("#pv-username", user);
    await page.type("#pv-password", pass);
    await page.click(".pv-account-submit");
    await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"), { timeout: 20000 });
    // Logout
    await page.click("#pv-account-logout");
    await page.waitForSelector("#pv-account-gate", { timeout: 10000 });
    // Login again
    await page.click('[data-mode="login"]');
    await page.$eval("#pv-username", (el) => (el.value = ""));
    await page.$eval("#pv-password", (el) => (el.value = ""));
    await page.type("#pv-username", user);
    await page.type("#pv-password", pass);
    await page.click(".pv-account-submit");
    await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"), { timeout: 20000 });
    const label = await page.$eval("#pv-account-chip-label", (el) => el.textContent);
    // Ensure andrea is not force-purged: register exactly andrea locally after clearing
    await page.evaluate(() => {
      localStorage.removeItem("viavia-accounts-db-v1");
      localStorage.removeItem("viavia-account-v1");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#pv-account-gate");
    await page.click('[data-mode="register"]');
    await page.$eval("#pv-username", (el) => (el.value = ""));
    await page.$eval("#pv-password", (el) => (el.value = ""));
    await page.type("#pv-username", "Andrea");
    await page.type("#pv-password", pass);
    await page.click(".pv-account-submit");
    await page.waitForFunction(() => document.body.classList.contains("pv-account-ready"), { timeout: 25000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    // After reload, session should stick (no purge)
    const stillIn = await page.waitForFunction(
      () => document.body.classList.contains("pv-account-ready"),
      { timeout: 15000 }
    ).then(() => true).catch(() => false);
    console.log(JSON.stringify({ user, label, andreaSurvivesReload: stillIn }));
    if (!stillIn) process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
