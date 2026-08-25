import { chromium } from "playwright";
const BASE = "http://localhost:8083";

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "admin@forgefabric.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/apply-intake`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('h4:has-text("New Bulk Order")').click({ force: true });
  await page.waitForTimeout(800);

  console.log("Selecting Aqtiv from customer dropdown...");
  const select = page.locator('select').first();
  const options = await select.locator('option').allTextContents();
  console.log("Options available:", JSON.stringify(options));

  const aqtivOption = options.find(o => o.toLowerCase().includes("aqtiv"));
  if (aqtivOption) {
    await select.selectOption({ label: aqtivOption });
  } else {
    console.log("Aqtiv not found in dropdown!");
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_intake_3_aqtiv_selected.png", fullPage: true });

  console.log("Filling Customer PO / Reference Number...");
  await page.fill('input[placeholder="e.g. the customer\'s own PO number"]', "AQTIV-PO-E2E-001");
  await page.waitForTimeout(500);

  const bodyText = await page.locator('body').innerText();
  console.log("Wizard Locked message still present:", bodyText.includes("Wizard Locked"));
  console.log("Contact email field value visible in body:", bodyText.includes("@"));

  await page.screenshot({ path: "_intake_4_ready.png", fullPage: true });

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
