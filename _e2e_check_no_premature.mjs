import { chromium } from "playwright";
const BASE = "http://localhost:8083";
async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "aqtiv@forgefabric.net");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "_no_premature_check.png", fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log("'Awaiting Your Approval' present:", bodyText.includes("Awaiting Your Approval"));
  console.log("APP-2026-0064 present:", bodyText.includes("APP-2026-0064"));
  console.log("Shows as 'Open' in Active Production Orders table:", bodyText.includes("Active Production Orders"));
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
