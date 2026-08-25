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
  await page.locator('select').first().selectOption({ label: "Aqtiv (AQTI-CUST) — Active CRM Account" });
  await page.waitForTimeout(1500);
  await page.fill('input[placeholder="Phone number"]', "5125551234");
  const refInput = page.locator('input[placeholder="e.g. PO-2026-0140 or APP-8842"]');
  if (await refInput.isVisible().catch(() => false)) {
    await refInput.fill("AQTIV-PO-E2E-002");
  }
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Continue to Order Details")').click();
  await page.waitForTimeout(1500);

  console.log("On Step 2 - filling style block...");
  await page.locator('button:has-text("Full CMT")').click();
  await page.waitForTimeout(500);
  await page.fill('input[placeholder="e.g. Paul Straight Leg Jean"]', "E2E Customer Review Jean");
  await page.fill('input[placeholder="e.g. SKU-2026-RAW"]', "SKU-E2E-001");
  await page.fill('input[placeholder="e.g. Deep Indigo"]', "Deep Indigo");
  await page.waitForTimeout(500);

  console.log("Filling size matrix quantities...");
  const qtyInputs = page.locator('input[type="number"]');
  const count = await qtyInputs.count();
  console.log("  Number of qty inputs found:", count);
  for (let i = 0; i < Math.min(count, 3); i++) {
    await qtyInputs.nth(i).fill("50");
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: "_intake_7_step2_filled.png", fullPage: true });

  console.log("Clicking Continue to Cut Sheet Ticket...");
  const contBtn = page.locator('button:has-text("Continue to Cut Sheet Ticket")');
  const disabled = await contBtn.isDisabled().catch(() => true);
  console.log("  Disabled?", disabled);
  if (!disabled) {
    await contBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "_intake_8_step3.png", fullPage: true });

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
