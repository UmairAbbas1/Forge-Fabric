import { chromium } from "playwright";
import path from "path";

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function captureIntakePortal() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    console.log("Navigating to /apply...");
    await page.goto(`${baseUrl}/apply`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const screenshotIndex = path.join(artifactDir, "intake_portal_index.png");
    await page.screenshot({ path: screenshotIndex, fullPage: true });
    console.log(`Saved screenshot: ${screenshotIndex}`);

    console.log("Navigating to /apply/new...");
    await page.goto(`${baseUrl}/apply/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const screenshotWizard = path.join(artifactDir, "intake_portal_wizard.png");
    await page.screenshot({ path: screenshotWizard, fullPage: true });
    console.log(`Saved screenshot: ${screenshotWizard}`);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

captureIntakePortal();
