const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log('--- TEST: Log in as Customer & Navigate Intake Wizard ---');
  await page.goto('http://localhost:8080/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', 'customer@forgefabric.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // Navigate to /apply/new
  await page.goto('http://localhost:8080/apply/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // 1. Select "New Bulk Order"
  await page.locator('input[type="radio"][value="new_order"]').check({ force: true });
  await page.waitForTimeout(600);

  // Click Continue to Step 2
  const nextBtn1 = page.locator('button:has-text("Continue")').first();
  await nextBtn1.click();
  await page.waitForTimeout(1000);

  // Step 2: Fill Style Name, SKU, Colorway and Quantity in Matrix
  console.log('On Step 2: Order & Sizes');
  const styleNameInput = page.locator('input[placeholder*="Paul Straight Leg"]').first();
  if (await styleNameInput.count() > 0) {
    await styleNameInput.fill('Rush Denim 501 Classic');
  }

  const skuInput = page.locator('input[placeholder*="SKU-2026-RAW"]').first();
  if (await skuInput.count() > 0) {
    await skuInput.fill('SKU-RUSH-2026');
  }

  const colorInput = page.locator('input[placeholder*="Vintage Indigo"]').first();
  if (await colorInput.count() > 0) {
    await colorInput.fill('Raw Dark Indigo');
  }

  // Fill 100 in first size input
  const sizeInput = page.locator('table input[type="number"]').first();
  if (await sizeInput.count() > 0) {
    await sizeInput.fill('100');
  }

  // Continue to Step 3
  const nextBtn2 = page.locator('button:has-text("Continue")').first();
  await nextBtn2.click();
  await page.waitForTimeout(1000);

  // Step 3: Cut Sheet -> Continue to Step 4
  console.log('On Step 3: Cut Sheet');
  const nextBtn3 = page.locator('button:has-text("Continue")').first();
  if (await nextBtn3.count() > 0) {
    await nextBtn3.click();
    await page.waitForTimeout(1000);
  }

  // Step 4: Documents -> Upload mandatory image
  console.log('On Step 4: Documents');
  const fileInput = page.locator('input[type="file"]').first();
  const sampleImagePath = path.join(__dirname, '../public/favicon.png');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(sampleImagePath);
    await page.waitForTimeout(1000);
  }

  const nextBtn4 = page.locator('button:has-text("Continue")').first();
  if (await nextBtn4.count() > 0) {
    await nextBtn4.click();
    await page.waitForTimeout(1200);
  }

  // Step 5: Review Summary
  console.log('On Step 5: Review Summary');
  
  // Click Rush Process radio
  const rushRadio = page.locator('input[type="radio"][name="production_priority"]').nth(1);
  if (await rushRadio.count() > 0) {
    await rushRadio.click();
    await page.waitForTimeout(600);
  }

  // Capture screenshot of Step 5 with Rush Tiers
  const artifactDir = 'C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da';
  const rushReviewPath = path.join(artifactDir, 'intake_step5_rush_tiers.png');
  await page.screenshot({ path: rushReviewPath, fullPage: true });
  console.log('Saved screenshot of Step 5 Rush Tiers:', rushReviewPath);

  // Click "Complex" tier
  const complexBtn = page.locator('button:has-text("Complex")').first();
  if (await complexBtn.count() > 0) {
    await complexBtn.click();
    await page.waitForTimeout(500);
  }

  const rushReviewComplexPath = path.join(artifactDir, 'intake_step5_rush_complex.png');
  await page.screenshot({ path: rushReviewComplexPath, fullPage: true });
  console.log('Saved screenshot of Complex tier selected:', rushReviewComplexPath);

  // Click "Simple" tier
  const simpleBtn = page.locator('button:has-text("Simple")').first();
  if (await simpleBtn.count() > 0) {
    await simpleBtn.click();
    await page.waitForTimeout(500);
  }

  const rushReviewSimplePath = path.join(artifactDir, 'intake_step5_rush_simple.png');
  await page.screenshot({ path: rushReviewSimplePath, fullPage: true });
  console.log('Saved screenshot of Simple tier selected:', rushReviewSimplePath);

  await browser.close();
  console.log('Bulk order intake review rush tier tests completed successfully!');
})().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
