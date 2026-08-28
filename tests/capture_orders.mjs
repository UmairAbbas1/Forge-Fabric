import { chromium } from "playwright";
import path from "path";

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function captureOrdersTable() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const merchCard = page.locator('div:has-text("Admin"):has-text("CLICK TO ENTER")').last();
    await merchCard.click();
    await page.waitForTimeout(2000);

    await page.goto(`${baseUrl}/orders`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);

    const ordersScreenshot = path.join(artifactDir, "verified_orders_stage_loaded.png");
    await page.screenshot({ path: ordersScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${ordersScreenshot}`);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

captureOrdersTable();
