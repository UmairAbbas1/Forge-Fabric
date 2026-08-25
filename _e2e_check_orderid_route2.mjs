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
  await page.goto(`${BASE}/orders/APP-2026-0063`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  console.log("URL:", page.url());
  console.log("BODY:\n", (await page.locator('body').innerText()).slice(0, 800));
  await page.screenshot({ path: "_orderid_check.png", fullPage: true });
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
