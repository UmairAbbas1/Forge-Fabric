const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('--- TEST 1: Intake Wizard Review Step Rush Tiers ---');
  await page.goto('http://localhost:8080/apply/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // Step 1: Fill company info
  const companyInput = page.locator('input[placeholder*="Iron & Indigo"]').first();
  if (await companyInput.count() > 0) {
    await companyInput.fill('Rush Denim Industries Inc.');
  }

  const contactInput = page.locator('input[placeholder*="Alex Mercer"]').first();
  if (await contactInput.count() > 0) {
    await contactInput.fill('Sarah Rush');
  }

  const emailInput = page.locator('input[placeholder*="alex@ironindigo.com"]').first();
  if (await emailInput.count() > 0) {
    await emailInput.fill('sarah@rushdenim.com');
  }

  const phoneInput = page.locator('input[type="tel"]').first();
  if (await phoneInput.count() > 0) {
    await phoneInput.fill('2125550199');
  }

  // Address fields if present
  const streetInput = page.locator('input[placeholder*="Street Address"], input[placeholder*="123 Industrial"]').first();
  if (await streetInput.count() > 0) {
    await streetInput.fill('100 Fashion Ave');
  }
  const cityInput = page.locator('input[placeholder*="City"]').first();
  if (await cityInput.count() > 0) {
    await cityInput.fill('New York');
  }
  const zipInput = page.locator('input[placeholder*="ZIP"], input[placeholder*="Postal"]').first();
  if (await zipInput.count() > 0) {
    await zipInput.fill('10001');
  }

  // Next to Step 2
  const nextBtn1 = page.locator('button:has-text("Continue")').first();
  await nextBtn1.click();
  await page.waitForTimeout(600);

  // Step 2: Order & Sizes
  const nextBtn2 = page.locator('button:has-text("Continue")').first();
  if (await nextBtn2.count() > 0) {
    await nextBtn2.click();
    await page.waitForTimeout(600);
  }

  // Step 3: Cut Sheet
  const nextBtn3 = page.locator('button:has-text("Continue")').first();
  if (await nextBtn3.count() > 0) {
    await nextBtn3.click();
    await page.waitForTimeout(600);
  }

  // Step 4: Documents
  const nextBtn4 = page.locator('button:has-text("Continue")').first();
  if (await nextBtn4.count() > 0) {
    await nextBtn4.click();
    await page.waitForTimeout(600);
  }

  // Step 5: Review & Priority
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
    await page.waitForTimeout(400);
    console.log('Selected Complex tier successfully');
  }

  const rushReviewComplexPath = path.join(artifactDir, 'intake_step5_rush_complex.png');
  await page.screenshot({ path: rushReviewComplexPath, fullPage: true });
  console.log('Saved screenshot of Complex tier selected:', rushReviewComplexPath);

  console.log('--- TEST 2: Merchandiser Submissions & Pricing Settings ---');
  await page.goto('http://localhost:8080/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', 'admin@forgefabric.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // Check Settings Pricing Rush panel
  await page.goto('http://localhost:8080/settings/pricing', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const rushTab = page.locator('button:has-text("Rush Pricing")').first();
  if (await rushTab.count() > 0) {
    await rushTab.click();
    await page.waitForTimeout(600);
    const pricingRushPath = path.join(artifactDir, 'settings_pricing_rush_tiers.png');
    await page.screenshot({ path: pricingRushPath, fullPage: true });
    console.log('Saved settings pricing screenshot:', pricingRushPath);
  }

  // Check Submissions Inbox
  await page.goto('http://localhost:8080/submissions', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const submissionsPath = path.join(artifactDir, 'submissions_inbox_rush.png');
  await page.screenshot({ path: submissionsPath, fullPage: true });
  console.log('Saved submissions inbox screenshot:', submissionsPath);

  await browser.close();
  console.log('All tests completed successfully!');
})().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
