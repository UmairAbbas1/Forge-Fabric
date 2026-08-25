import { chromium } from "playwright";
const BASE = "http://localhost:8083";

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });

  console.log("1. Log in as Aqtiv customer...");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "aqtiv@forgefabric.net");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);
  console.log("   URL after login:", page.url());

  await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "_review_1_orders_dashboard.png", fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log("2. 'Awaiting Your Approval' section visible:", bodyText.includes("Awaiting Your Approval"));
  console.log("   Reference APP-2026-0063 visible:", bodyText.includes("APP-2026-0063"));

  console.log("3. Clicking into the review...");
  await page.locator('a[href="/orders/review/5e8e5f0b-0505-4929-a6e0-a569f5a4ebd9"]').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "_review_2_review_screen.png", fullPage: true });
  console.log("   URL:", page.url());

  const reviewBody = await page.locator('body').innerText();
  console.log("   Review screen shows company name Aqtiv:", reviewBody.includes("Aqtiv"));
  console.log("   Review screen shows style E2E Customer Review Jean:", reviewBody.includes("E2E Customer Review Jean"));
  console.log("   Review screen shows size matrix:", reviewBody.includes("28"));
  console.log("   Review screen shows PO reference:", reviewBody.includes("AQTIV-PO-E2E-002"));
  console.log("   Approve button present:", reviewBody.includes("Approve"));

  console.log("Console errors:", consoleErrors.filter(e => !e.includes("Transitioner")));

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
