import { chromium } from "playwright";
const BASE = "http://localhost:8083";
async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(15000);
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.type(), m.text().slice(0,300)); });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  page.on("response", async res => {
    if (res.url().includes("orders/review") || res.status() >= 400) {
      console.log("[response]", res.status(), res.url());
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "aqtiv@forgefabric.net");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);

  console.log("--- navigating to review route ---");
  await page.goto(`${BASE}/orders/review/5e8e5f0b-0505-4929-a6e0-a569f5a4ebd9`, { waitUntil: "load", timeout: 60000 }).catch(e => console.log("goto error:", e.message));
  await page.waitForTimeout(3000);
  console.log("Final URL:", page.url());

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
