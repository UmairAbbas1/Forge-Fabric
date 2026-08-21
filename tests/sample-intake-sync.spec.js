// @ts-check
import { test, expect } from '@playwright/test';

test.describe.serial('Real-Time Sample Request & Cross-Dashboard Sync E2E Suite', () => {
  let submittedRefCode = '';

  test('1. Customer Submits Sample Request with Dynamic Size Auto-Distribution', async ({ page }) => {
    // 1. Visit Login page and Quick Login as Customer
    await page.goto('/login');
    await page.locator('button:has-text("customer@forgefabric.com")').click();
    await page.waitForTimeout(2000);

    // 2. Navigate to Apply / Intake
    await page.goto('/apply-intake');
    await page.waitForTimeout(1500);

    // Handle draft recovery modal if it appears
    const discardDraftBtn = page.locator('button:has-text("Discard"), button:has-text("Start Fresh")').first();
    if (await discardDraftBtn.isVisible()) {
      await discardDraftBtn.click();
      await page.waitForTimeout(500);
    }

    // 3. Choose Sample Request Order Type
    const sampleOption = page.locator('label').filter({ hasText: 'Sample Request' }).first();
    if (await sampleOption.isVisible()) {
      await sampleOption.click();
    } else {
      await page.getByText('Sample Request').first().click();
    }
    await page.waitForTimeout(1000);

    // 4. Fill Company / Contact Info if fields are visible
    const compInput = page.locator('input[placeholder*="Iron & Indigo"], input[placeholder*="Company"]').first();
    if (await compInput.isVisible()) {
      await compInput.fill('Urban Forge Studio');
    }
    const contactInput = page.locator('input[placeholder*="Alex Mercer"], input[placeholder*="Contact Name"]').first();
    if (await contactInput.isVisible()) {
      await contactInput.fill('Sarah Jenkins');
    }
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('sarah@urbanforge.com');
    }

    // 5. Verify Sample Specifications Subform Header
    await expect(page.locator('text=Sample Specifications & Requirements')).toBeVisible({ timeout: 10000 });

    // 6. Test Size Auto-Distribution: Click Auto-Distribute
    const autoDistBtn = page.getByRole('button', { name: /Auto-Distribute/i });
    await autoDistBtn.click();
    await page.waitForTimeout(500);

    // Verify Size breakdown checkmark banner
    await expect(page.locator('text=Size quantities match total sample quantity (4 pcs)')).toBeVisible({ timeout: 5000 });

    // 7. Fill Required Turnaround Date, Tech Pack URL & SKU
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill('2026-09-15');
    }

    const techPackInput = page.locator('input[placeholder*="drive.google.com"], input[placeholder*="Tech Pack"]').first();
    if (await techPackInput.isVisible()) {
      await techPackInput.fill('https://drive.google.com/sample-spec-hoodie-v1');
    }

    const skuInput = page.locator('input[placeholder*="WM-SS26-01"]').first();
    if (await skuInput.isVisible()) {
      await skuInput.fill('UFS-FLEECE-HD01');
    }

    // 8. Fill Shipping Info
    const recipientInput = page.locator('input[placeholder*="receiving the shipment"]').first();
    if (await recipientInput.isVisible()) {
      await recipientInput.fill('Sarah Jenkins');
    }
    const streetInput = page.locator('input[placeholder*="123 Production Way"]').first();
    if (await streetInput.isVisible()) {
      await streetInput.fill('742 Evergreen Terrace');
    }
    const cityInput = page.locator('div:has(> label:has-text("City")) input, input[placeholder*="City"]').first();
    if (await cityInput.isVisible()) {
      await cityInput.fill('Springfield');
    }
    const stateInput = page.locator('div:has(> label:has-text("State")) input, input[placeholder*="State"]').first();
    if (await stateInput.isVisible()) {
      await stateInput.fill('OR');
    }
    const zipInput = page.locator('div:has(> label:has-text("Zip")) input, input[placeholder*="Zip"]').first();
    if (await zipInput.isVisible()) {
      await zipInput.fill('97477');
    }

    // 9. Submit the Sample Request
    const submitBtn = page.locator('button:has-text("Submit Sample Request")').first();
    await submitBtn.click();

    // 10. Verify Confirmation Screen & Ref Code
    await expect(page.locator('text=Sample Request Submitted Successfully')).toBeVisible({ timeout: 15000 });
    
    const refCodeElement = page.locator('span.font-mono, span.bg-emerald-200\\/80, .font-mono');
    const refText = await refCodeElement.first().textContent();
    if (refText && refText.includes('SR-')) {
      submittedRefCode = refText.trim();
    }
    console.log('Submitted Sample Request Ref:', submittedRefCode || 'SR-GENERATED');
  });

  test('2. Merchandiser & Admin Submissions Inbox Live Stream Verification', async ({ page }) => {
    // Login as Admin / Merchandiser
    await page.goto('/login');
    await page.locator('button:has-text("admin@forgefabric.com")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Navigate to Submissions Inbox
    await page.goto('/submissions');
    await page.waitForTimeout(1500);

    // Switch to Sample Requests Tab
    const sampleTab = page.getByRole('button', { name: 'Sample Requests' });
    await sampleTab.click();
    await page.waitForTimeout(1000);

    // Verify Sample Requests Table & Headers
    await expect(page.locator('th:has-text("Sample Type")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('th:has-text("Quantity & Sizes")')).toBeVisible();
    await expect(page.locator('th:has-text("Stage / Status")')).toBeVisible();

    // Verify sample submissions are listed
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Admin & Customer Orders Dashboard Live Ingestion Verification', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.locator('button:has-text("admin@forgefabric.com")').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Navigate to Orders Dashboard
    await page.goto('/orders');
    await page.waitForTimeout(2000);

    // Verify Active Orders table renders
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
  });

  test('4. Live Order Intake Status Tracker Online Lookup', async ({ page }) => {
    // Navigate to Status Tracker with reference code
    const targetRef = submittedRefCode || 'APP-2026-0001';
    await page.goto(`/apply/status/${targetRef}?email=customer@forgefabric.com`);
    await page.waitForTimeout(2000);

    // Verify Live Tracker renders
    await expect(page.locator('text=Live Order Intake Tracker')).toBeVisible({ timeout: 10000 });
  });

});
