import { chromium } from "playwright";
const BASE = "http://localhost:8083";

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });

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

  const select = page.locator('select').first();
  await select.selectOption({ label: "Aqtiv (AQTI-CUST) — Active CRM Account" });
  await page.waitForTimeout(1500);

  console.log("Filling phone number...");
  await page.fill('input[placeholder="Phone number"]', "5125551234");
  await page.waitForTimeout(300);

  console.log("Filling PO/Reference in Section 3...");
  const refInput = page.locator('input[placeholder="e.g. PO-2026-0140 or APP-8842"]');
  if (await refInput.isVisible().catch(() => false)) {
    await refInput.fill("AQTIV-PO-E2E-002");
  } else {
    console.log("  Reference input not visible - checking existingPoList cards instead");
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: "_intake_5_before_continue.png", fullPage: true });

  console.log("Clicking Continue to Order Details...");
  const continueBtn = page.locator('button:has-text("Continue to Order Details")');
  const isDisabled = await continueBtn.isDisabled().catch(() => true);
  console.log("  Continue button disabled?", isDisabled);
  if (!isDisabled) {
    await continueBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "_intake_6_step2.png", fullPage: true });
  console.log("URL now:", page.url());

  console.log("Console errors so far:", consoleErrors.filter(e => !e.includes("Transitioner")));

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
