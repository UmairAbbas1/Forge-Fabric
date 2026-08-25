import { chromium } from "playwright";
const BASE = "http://localhost:8083";
async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);
  page.on("console", m => { if (m.type() === "error") console.log("[console err]", m.text().slice(0,300)); });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "aqtiv@forgefabric.net");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/orders/review/5e8e5f0b-0505-4929-a6e0-a569f5a4ebd9`, { waitUntil: "load", timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(3000);

  console.log("Clicking Approve & Start Production...");
  await page.locator('button:has-text("Approve & Start Production")').click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "_approve_result.png", fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log("Body after approve:", bodyText.slice(0, 500));

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
