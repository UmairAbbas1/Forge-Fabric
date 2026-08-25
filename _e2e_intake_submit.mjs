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

  await page.locator('button:has-text("Full CMT")').click();
  await page.waitForTimeout(500);
  await page.fill('input[placeholder="e.g. Paul Straight Leg Jean"]', "E2E Customer Review Jean");
  await page.fill('input[placeholder="e.g. SKU-2026-RAW"]', "SKU-E2E-001");
  await page.fill('input[placeholder="e.g. Deep Indigo"]', "Deep Indigo");
  const qtyInputs = page.locator('input[type="number"]');
  const count = await qtyInputs.count();
  for (let i = 0; i < Math.min(count, 3); i++) {
    await qtyInputs.nth(i).fill("50");
  }
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Continue to Cut Sheet Ticket")').click();
  await page.waitForTimeout(1500);

  console.log("Step 3 - clicking Continue to Document Vault...");
  await page.locator('button:has-text("Continue to Document Vault")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_intake_9_step4.png", fullPage: true });

  console.log("Step 4 - looking for continue button...");
  const step4Btn = page.locator('button:has-text("Continue to Review")');
  if (await step4Btn.isVisible().catch(() => false)) {
    await step4Btn.click();
  } else {
    const buttons = await page.locator('button').allTextContents();
    console.log("Available buttons:", JSON.stringify(buttons.filter(b => b.trim())));
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_intake_10_step5.png", fullPage: true });
  console.log("Body text on final step:", (await page.locator('body').innerText()).slice(0, 500));

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
