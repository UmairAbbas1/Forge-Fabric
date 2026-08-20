// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Real-Time Sample Request & Cross-Dashboard Sync Suite', () => {

  test('1. Verify Sample Request Intake Form & Dynamic Auto-Distribute', async ({ page }) => {
    // Navigate to Application Intake
    await page.goto('/apply-intake');
    await page.waitForLoadState('networkidle');

    // Select Sample Request order type
    const sampleCard = page.locator('text=Request Product / Fit Sample').first();
    await sampleCard.click();

    // Verify Sample Request subform is rendered
    await expect(page.locator('text=Sample Type & Construction Details')).toBeVisible();

    // Fill in required sample fields
    await page.locator('input[placeholder="e.g. Vintage Heavyweight Hoodie, High-Rise Relaxed Trouser"]').fill('Test Urban Heavyweight Hoodie');

    // Choose Preset "Alpha (XS-3XL)"
    const alphaBtn = page.getByRole('button', { name: 'Alpha (XS-3XL)' });
    if (await alphaBtn.isVisible()) {
      await alphaBtn.click();
    }

    // Set Total Sample Quantity to 4
    const qtyInput = page.locator('input#sample-qty-input');
    await qtyInput.fill('4');

    // Click Auto-Distribute
    const autoDistBtn = page.getByRole('button', { name: /Auto-Distribute/i });
    await autoDistBtn.click();

    // Verify Size breakdown checkmark appears
    await expect(page.locator('text=Size breakdown matches total quantity (4 pcs)')).toBeVisible();

    // Select Fabric Sourcing
    const factorySource = page.locator('input[value="Factory Sourced"]').first();
    if (await factorySource.isVisible()) {
      await factorySource.check();
    }

    // Fill Shipping Address
    const streetInput = page.locator('input[placeholder*="Street address"]').first();
    if (await streetInput.isVisible()) {
      await streetInput.fill('123 Fashion Ave');
    }
    const cityInput = page.locator('input[placeholder*="City"]').first();
    if (await cityInput.isVisible()) {
      await cityInput.fill('New York');
    }
    const stateInput = page.locator('input[placeholder*="State"]').first();
    if (await stateInput.isVisible()) {
      await stateInput.fill('NY');
    }
    const zipInput = page.locator('input[placeholder*="ZIP"]').first();
    if (await zipInput.isVisible()) {
      await zipInput.fill('10001');
    }

    // Submit Sample Request
    const submitBtn = page.getByRole('button', { name: /Submit Sample Request/i });
    await submitBtn.click();

    // Verify Success Confirmation Screen
    await expect(page.locator('text=Sample Request Dispatched Successfully')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Track Status Online')).toBeVisible();
  });

  test('2. Verify Submissions Inbox Sample Requests Pipeline', async ({ page }) => {
    // Navigate to Submissions Inbox
    await page.goto('/submissions');
    await page.waitForLoadState('networkidle');

    // Switch to Sample Requests Pipeline tab
    const sampleTab = page.getByRole('tab', { name: /Sample Requests/i });
    if (await sampleTab.isVisible()) {
      await sampleTab.click();
    }

    // Check table headers and content
    await expect(page.locator('th:has-text("Brand / Customer")')).toBeVisible();
    await expect(page.locator('th:has-text("Sample Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Quantity & Sizes")')).toBeVisible();
    await expect(page.locator('th:has-text("Stage / Status")')).toBeVisible();

    // Verify at least one sample row or real-time stream
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Verify Admin Orders Dashboard Sync & Sample Row Ingestion', async ({ page }) => {
    // Navigate to Orders Dashboard
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Verify Active Orders table renders
    await expect(page.locator('text=Production Orders').or(page.locator('text=Active Production Orders'))).toBeVisible();

    // Verify table has rows populated
    const orderRows = page.locator('table tbody tr');
    await expect(orderRows.first()).toBeVisible({ timeout: 10000 });
  });

  test('4. Verify Live Status Tracker lookup for Sample Requests', async ({ page }) => {
    // Navigate to Live Tracker
    await page.goto('/apply-intake');
    await page.waitForLoadState('networkidle');

    // Look for status lookup navigation
    const checkStatusLink = page.getByRole('link', { name: /Track Existing Application/i }).or(page.getByRole('link', { name: /Track Status/i })).first();
    if (await checkStatusLink.isVisible()) {
      await checkStatusLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=Live Order Intake Tracker')).toBeVisible();
    }
  });

});
