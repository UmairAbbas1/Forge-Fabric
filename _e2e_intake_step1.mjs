import { chromium } from "playwright";
const BASE = "http://localhost:8083";

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);

  console.log("1. Log in as admin...");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "admin@forgefabric.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);

  console.log("2. Navigate to /apply-intake...");
  await page.goto(`${BASE}/apply-intake`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  console.log("3. Switch classification to New Bulk Order (click label text)...");
  await page.locator('h4:has-text("New Bulk Order")').click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "_intake_2_bulk_selected.png", fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log("   Page mentions 'Customer PO / Reference':", bodyText.includes("Customer PO"));

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
