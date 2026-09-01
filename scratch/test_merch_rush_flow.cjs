const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log('--- TEST: Merchandiser Submissions & Conversion Modal Rush Tiers ---');
  await page.goto('http://localhost:8080/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', 'merch@forgefabric.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Navigate to /submissions
  await page.goto('http://localhost:8080/submissions', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.innerText.includes('Initialising session'), { timeout: 15000 });
  await page.waitForTimeout(1500);

  const artifactDir = 'C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da';
  const submissionsPath = path.join(artifactDir, 'submissions_inbox_authenticated.png');
  await page.screenshot({ path: submissionsPath, fullPage: true });
  console.log('Saved authenticated submissions inbox screenshot:', submissionsPath);

  // Open first submission or click "Convert" if available
  const convertBtn = page.locator('button:has-text("Convert to PO"), button:has-text("Convert")').first();
  if (await convertBtn.count() > 0) {
    await convertBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to Step 4 of ConversionModal (Order Specs)
    const step4Btn = page.locator('button:has-text("4. Production Details"), button:has-text("4.")').first();
    if (await step4Btn.count() > 0) {
      await step4Btn.click();
      await page.waitForTimeout(600);
    }

    // Switch priority to Rush
    const prioritySelect = page.locator('select').filter({ hasText: 'Normal' }).first();
    if (await prioritySelect.count() > 0) {
      await prioritySelect.selectOption('Rush');
      await page.waitForTimeout(500);
    }

    const conversionRushPath = path.join(artifactDir, 'conversion_modal_step4_rush.png');
    await page.screenshot({ path: conversionRushPath, fullPage: true });
    console.log('Saved conversion modal step 4 rush screenshot:', conversionRushPath);
  }

  await browser.close();
  console.log('Merchandiser conversion modal rush tests completed successfully!');
})().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
