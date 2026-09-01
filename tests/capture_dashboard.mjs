import { chromium } from "playwright";
import path from "path";

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function captureDashboard() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    console.log("Navigating to /login...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Login as admin
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill("admin@forgefabric.com");
      await passwordInput.fill("password123");
      await page.getByRole("button", { name: /Sign In/i }).click();
      await page.waitForTimeout(2000);
      await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
    }

    console.log("Navigating to /dashboard...");
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
    await page.waitForTimeout(2000);

    const screenshotDashboard = path.join(artifactDir, "dashboard_minimalist.png");
    await page.screenshot({ path: screenshotDashboard, fullPage: true });
    console.log(`Saved dashboard screenshot: ${screenshotDashboard}`);

    console.log("Navigating to /orders...");
    await page.goto(`${baseUrl}/orders`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
    await page.waitForTimeout(2000);

    const screenshotOrders = path.join(artifactDir, "orders_minimalist.png");
    await page.screenshot({ path: screenshotOrders, fullPage: true });
    console.log(`Saved orders screenshot: ${screenshotOrders}`);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

captureDashboard();
