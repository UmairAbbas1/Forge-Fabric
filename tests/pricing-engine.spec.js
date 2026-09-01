// @ts-check
// Pricing & Rates engine — Phase G E2E suite.
//
// Reads tests/.e2e-pricing-seed.json (written by tests/seed-pricing-e2e.mjs,
// which must be run first) for real reference codes / IDs / expected values,
// same convention as the existing REQ-14/15 suite (seed-e2e-order.mjs +
// req14-req15-selective-outsourcing.spec.js). Run tests/cleanup-pricing-e2e.mjs
// after this suite finishes.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const seed = JSON.parse(readFileSync(new URL('./.e2e-pricing-seed.json', import.meta.url), 'utf8'));

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

async function login(page, email, password = 'password123') {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

// Scopes into one SectionCard (AppShell.tsx) by its title, so a form's own
// selects/inputs are never confused with the filter controls in a sibling
// card that happens to render the same option labels (e.g. the Article
// Type filter dropdown vs. the "Add Rate Card" form's own Article Type
// select).
function sectionCard(page, title) {
  return page.locator('div.card-opaque', { has: page.locator('h3', { hasText: title }) });
}

async function openQuoteModalForRef(page, refCode) {
  await page.goto('/submissions');
  const search = page.getByPlaceholder('Search brand, email, ref...');
  await search.fill(refCode);
  await page.waitForTimeout(600);
  const row = page.locator('tr', { hasText: refCode }).first();
  await row.click();
  const quoteBtn = page.locator('button', { hasText: /Issue Price Quote|Revise Quote|Revise & Resend Quote/ }).first();
  await quoteBtn.waitFor({ state: 'visible', timeout: 10000 });
  await quoteBtn.click();
  await expect(page.locator('text=Merchandiser Unit Cost Calculator, text=Sample Pricing Calculator').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
}

test.describe.serial('Pricing & Rates Engine E2E Suite', () => {

  test('1. Admin creates a rate card, cycle profile, rush multiplier tier, and customer discount rule', async ({ page }) => {
    await login(page, 'admin@forgefabric.com');
    await page.goto('/settings/pricing');
    await expect(page.locator('h1', { hasText: 'Pricing & Rates' })).toBeVisible({ timeout: 10000 });

    // -- Standard Rates: create a Dress/cmt_base/woven rate card --
    await page.locator('button', { hasText: 'Standard Rates' }).click();
    const rateCardForm = sectionCard(page, 'Add Rate Card');
    await rateCardForm.locator('select').nth(0).selectOption('Dress');
    await rateCardForm.locator('select').nth(1).selectOption('cmt_base');
    await rateCardForm.locator('select').nth(2).selectOption('woven');
    await rateCardForm.locator('input[placeholder="e.g. 4.50"]').fill('5.25');
    await rateCardForm.locator('input[placeholder="e.g. 20"]').fill('22');
    await rateCardForm.locator('button', { hasText: 'Add Rate Card' }).click();
    const rateCardTable = sectionCard(page, 'Standard Rate Cards');
    await expect(rateCardTable.locator('td', { hasText: 'Dress' }).first()).toBeVisible({ timeout: 10000 });
    await expect(rateCardTable.locator('td', { hasText: '$5.25' }).first()).toBeVisible();

    // -- Rush Pricing: cycle profile (Dress) + multiplier tier (Moderate) --
    await page.locator('button', { hasText: 'Rush Pricing' }).click();
    const profileForm = sectionCard(page, 'Add Cycle Profile');
    await profileForm.locator('select').nth(0).selectOption('Dress');
    await profileForm.locator('select').nth(1).selectOption('Moderate');
    await profileForm.locator('input[placeholder="e.g. 800"]').fill('1200');
    await profileForm.locator('button', { hasText: 'Add Profile' }).click();
    const profileTable = sectionCard(page, 'Article Cycle Profiles');
    await expect(profileTable.locator('td', { hasText: 'Dress' }).first()).toBeVisible({ timeout: 10000 });

    const tierForm = sectionCard(page, 'Add Multiplier Tier');
    await tierForm.locator('select').nth(0).selectOption('Moderate');
    await tierForm.locator('input[placeholder="e.g. 1.75"]').fill('1.5');
    await tierForm.locator('button', { hasText: 'Add Tier' }).click();
    const tierTable = sectionCard(page, 'Rush Multiplier Tiers');
    await expect(tierTable.locator('td', { hasText: '1.50x' })).toBeVisible({ timeout: 10000 });

    // -- Customer Discounts: create a rule against a 3rd real company --
    await page.locator('button', { hasText: 'Customer Discounts' }).click();
    const discountForm = sectionCard(page, 'Add Discount Rule');
    await discountForm.getByPlaceholder('Search company name...').fill('Servade');
    await discountForm.locator('button', { hasText: 'Servade' }).first().click();
    await expect(discountForm.locator('text=Selected ✓')).toBeVisible();
    await discountForm.locator('input[placeholder="e.g. 10"]').fill('12');
    await discountForm.locator('button', { hasText: 'Add Discount Rule' }).click();
    const discountTable = sectionCard(page, 'Customer Discount Rules');
    await expect(discountTable.locator('td', { hasText: 'Servade' }).first()).toBeVisible({ timeout: 10000 });

    // -- Sample Pricing: create a Dress rule --
    await page.locator('button', { hasText: 'Sample Pricing' }).click();
    const sampleForm = sectionCard(page, 'Add Sample Pricing Rule');
    await sampleForm.locator('select').nth(0).selectOption('Dress');
    await sampleForm.locator('input[placeholder*="150.00"]').fill('80');
    await sampleForm.locator('button', { hasText: 'Add Rule' }).click();
    const sampleTable = sectionCard(page, 'Sample Pricing Rules');
    await expect(sampleTable.locator('td', { hasText: 'Dress' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('2. Merchandiser: non-rush bulk order auto-fills from rate card and computes correct total', async ({ page }) => {
    await login(page, 'merch@forgefabric.com');
    await openQuoteModalForRef(page, seed.submissions.bulk.referenceCode);

    await expect(page.locator('label:has-text("CMT Base Labor") + input')).toHaveValue('4.5', { timeout: 10000 });
    await expect(page.locator('label:has-text("Wash Surcharge") + input')).toHaveValue('0.75');
    await expect(page.locator('label:has-text("Trims") + input')).toHaveValue('0.5');
    await expect(page.locator('label:has-text("Factory Margin") + input')).toHaveValue('20');
    await expect(page.locator('text=From rate card').first()).toBeVisible();

    // Base 5.75 + 20% margin = 6.90/pc, no rush, no discount, qty 500 -> $3,450.00
    await expect(page.locator('text=$6.90').first()).toBeVisible();
    await expect(page.locator('text=$3,450.00').first()).toBeVisible();
  });

  test('3a. Merchandiser: rush order (feasible) applies the complexity-tier multiplier with no infeasibility warning', async ({ page }) => {
    await login(page, 'merch@forgefabric.com');
    await openQuoteModalForRef(page, seed.submissions.rushFeasible.referenceCode);

    await expect(page.locator('text=Rush order').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Simple complexity.*1\\.30x rate multiplier/').first()).toBeVisible();
    await expect(page.locator('text=×1.30').first()).toBeVisible();
    // Base 6.90 × 1.3 rush = $8.97/pc, qty 500 -> $4,485.00
    await expect(page.locator('text=$8.97').first()).toBeVisible();
    await expect(page.locator('text=$4,485.00').first()).toBeVisible();
    await expect(page.locator("text=isn't realistically achievable")).not.toBeVisible();
  });

  test('3b. Merchandiser: rush order (infeasible) shows the earliest achievable date warning', async ({ page }) => {
    await login(page, 'merch@forgefabric.com');
    await openQuoteModalForRef(page, seed.submissions.rushInfeasible.referenceCode);

    await expect(page.locator('text=Rush order').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Complex complexity.*1\\.80x rate multiplier/').first()).toBeVisible();
    await expect(page.locator("text=isn't realistically achievable")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Earliest realistic ship date')).toBeVisible();
  });

  test('4. Merchandiser: order from a company with an active discount applies the discount correctly', async ({ page }) => {
    await login(page, 'merch@forgefabric.com');
    await openQuoteModalForRef(page, seed.submissions.discount.referenceCode);

    await expect(page.locator('text=/Active customer discount: 15\\.0%/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=−15.0%').first()).toBeVisible();
    // Base 6.90 × (1 − 0.15) = $5.87/pc, qty 500 -> $2,935.00
    await expect(page.locator('text=$5.87').first()).toBeVisible();
    await expect(page.locator('text=$2,935.00').first()).toBeVisible();
  });

  test('5. Merchandiser: Sample Request uses the simpler Sample Pricing path, not the bulk rate-card path', async ({ page }) => {
    await login(page, 'merch@forgefabric.com');
    await openQuoteModalForRef(page, seed.submissions.sample.referenceCode);

    await expect(page.locator('text=Sample Pricing Calculator')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=priced using Sample Pricing rates')).toBeVisible();
    // No bulk-path fields should render for a sample.
    await expect(page.locator('label:has-text("CMT Base Labor")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Factory Margin")')).not.toBeVisible();
    // flat $100 + 4 × $8 = $132 / 4 units = $33.00/pc
    await expect(page.locator('text=$33.00').first()).toBeVisible();
  });

  test('6. Merchandiser: a submission with no matching rate card leaves fields blank and required', async ({ page }) => {
    await login(page, 'merch@forgefabric.com');
    await openQuoteModalForRef(page, seed.submissions.noRateCard.referenceCode);

    const cmtInput = page.locator('label:has-text("CMT Base Labor") + input');
    await expect(cmtInput).toHaveValue('', { timeout: 10000 });
    await expect(page.locator('text=No matching rate card')).toBeVisible();

    // Attempting to issue without entering a cost is blocked with a real error.
    await page.locator('button', { hasText: 'Send Quote to Customer' }).click();
    await expect(page.locator('text=CMT Base Labor cost is required')).toBeVisible({ timeout: 5000 });
  });

  test('7. Real-time: a rate card created in one session appears in another open session without a refresh', async ({ browser }) => {
    // Self-cleaning: rate_cards has an active-combo unique index
    // (article_type, process, fabric_category) — a leftover ACTIVE row
    // from a previous run of this same test (e.g. one that failed after
    // creating it but before finishing) would make this run's insert fail
    // silently in the form, not just look confusingly similar. Removed
    // directly (now that admin has a real DELETE policy) rather than only
    // deactivated, since deactivating it would still leave a distracting
    // extra row for a manual admin looking at this table later.
    const dbAdmin = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    await dbAdmin.auth.signInWithPassword({ email: 'admin@forgefabric.com', password: 'password123' });
    await dbAdmin.from('rate_cards').delete().eq('article_type', 'Shorts').eq('process', 'cmt_base').eq('fabric_category', 'other');

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // A fresh, run-unique rate each time purely for a distinctive on-screen
    // marker (not for uniqueness — the delete above already guarantees a
    // clean slate for the combo itself).
    const uniqueRate = (1 + (Date.now() % 900) / 100).toFixed(2);
    const marker = `$${uniqueRate}`;

    await login(pageA, 'admin@forgefabric.com');
    await login(pageB, 'admin@forgefabric.com');

    await pageA.goto('/settings/pricing');
    await pageB.goto('/settings/pricing');
    await pageB.locator('button', { hasText: 'Standard Rates' }).click();
    const tableB = sectionCard(pageB, 'Standard Rate Cards');
    // Confirm the marker rate card does NOT already appear in session B.
    await expect(tableB.locator('td', { hasText: marker })).toHaveCount(0);
    // Let session B's realtime channel actually finish subscribing before
    // session A makes its change — confirmed via direct testing that the
    // channel settles a moment after the page's own data queries resolve,
    // not the instant the page navigates.
    await pageB.waitForTimeout(3000);

    await pageA.locator('button', { hasText: 'Standard Rates' }).click();
    const formA = sectionCard(pageA, 'Add Rate Card');
    await formA.locator('select').nth(0).selectOption('Shorts');
    await formA.locator('select').nth(1).selectOption('cmt_base');
    await formA.locator('select').nth(2).selectOption('other');
    await formA.locator('input[placeholder="e.g. 4.50"]').fill(uniqueRate);
    await formA.locator('input[placeholder="e.g. 20"]').fill('18');
    await formA.locator('button', { hasText: 'Add Rate Card' }).click();
    const tableA = sectionCard(pageA, 'Standard Rate Cards');
    await expect(tableA.locator('td', { hasText: marker }).first()).toBeVisible({ timeout: 10000 });

    // Session B never reloads — this must appear via realtime alone.
    await expect(tableB.locator('td', { hasText: marker }).first()).toBeVisible({ timeout: 30000 });

    await contextA.close();
    await contextB.close();
  });

  test('8. Finance: invoice breakdown matches the original accepted quote exactly', async ({ page }) => {
    await login(page, 'admin@forgefabric.com');
    await page.goto('/finance');
    await expect(page.locator('h1', { hasText: 'Finance & Invoicing' })).toBeVisible({ timeout: 10000 });

    const invoiceRow = page.locator('tr', { hasText: seed.invoice.orderId });
    await expect(invoiceRow).toBeVisible({ timeout: 10000 });
    await invoiceRow.locator('button[title="View itemized breakdown"]').click();

    await expect(page.locator('text=' + seed.invoice.quoteNumber)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Base CMT Labor')).toBeVisible();
    await expect(page.locator(`text=$${seed.invoice.finalUnitPrice.toFixed(2)}`).first()).toBeVisible();
    await expect(page.locator(`text=$${seed.invoice.totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`).first()).toBeVisible();
  });

});
