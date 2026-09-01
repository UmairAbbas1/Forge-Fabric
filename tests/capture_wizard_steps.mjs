import { chromium } from "playwright";
import path from "path";

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function captureAllWizardSteps() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    console.log("Navigating to /apply/new...");
    await page.goto(`${baseUrl}/apply/new`, { waitUntil: "domcontentloaded" });
    
    // Wait for the session initialisation to finish
    await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Step 1 Screenshot
    await page.screenshot({ path: path.join(artifactDir, "intake_step1_company.png"), fullPage: true });
    console.log("Captured Step 1");

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

captureAllWizardSteps();
