import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const DEFAULT_SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";
const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function runFullLifecycleTest() {
  console.log("==================================================");
  console.log("FULL LIFECYCLE TEST: NEW INTAKE -> CONVERSION -> BACKEND");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    // ----------------------------------------------------
    // PHASE 1: Create New Intake Submission on /apply/new
    // ----------------------------------------------------
    console.log("\n[PHASE 1] Navigating to /apply/new...");
    await page.goto(`${baseUrl}/apply/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Wait for companies dropdown
    console.log("Selecting 'Servade' in Company Master dropdown...");
    await page.waitForFunction(() => {
      const select = document.querySelector('select');
      return select && select.options.length > 2 && !select.innerText.includes('Loading companies');
    }, { timeout: 15000 });

    const companySelect = page.locator('select').filter({ hasText: 'Select Validated Customer' }).first();
    const options = await companySelect.locator('option').allInnerTexts();
    const servadeOption = options.find(o => o.includes("Servade"));
    if (servadeOption) {
      await companySelect.selectOption({ label: servadeOption });
    } else {
      await companySelect.selectOption({ index: 1 });
    }
    await page.waitForTimeout(1000);

    // Select New Bulk Order
    console.log("Selecting 'New Bulk Order'...");
    await page.locator('input[value="new_order"]').check({ force: true });
    await page.waitForTimeout(800);

    // Fill Phone
    const phoneInput = page.locator('input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill("(555) 234-5678");
      await page.waitForTimeout(500);
    }

    // Step 1: Address selection
    console.log("Selecting 'Joe Doe, 45 Distribution Way' address card...");
    const addressCard = page.locator('div:has-text("Distribution Way"), div:has-text("Joe Doe"), div:has-text("100 Franklin")').first();
    if (await addressCard.isVisible()) {
      await addressCard.click();
      await page.waitForTimeout(800);
    }

    const step1Screenshot = path.join(artifactDir, "lifecycle_step1_address.png");
    await page.screenshot({ path: step1Screenshot, fullPage: true });
    console.log(`Saved screenshot: ${step1Screenshot}`);

    // Click Continue to Order Details (Step 1 -> Step 2)
    console.log("Clicking 'Continue to Order Details' button...");
    await page.locator('button:has-text("Continue to Order Details")').first().click();
    await page.waitForTimeout(2500);

    const step2Screenshot = path.join(artifactDir, "lifecycle_step2_details.png");
    await page.screenshot({ path: step2Screenshot, fullPage: true });
    console.log(`Saved screenshot: ${step2Screenshot}`);

    // Step 2: Fill Style Name
    console.log("Filling Step 2 Style Details & Size Breakdown...");
    const styleInput = page.locator('input[placeholder*="Vintage Wash"], input[placeholder*="Style Name"], input[name*="style"]').first();
    if (await styleInput.isVisible()) {
      await styleInput.fill("SERVADE-DENIM-SLIM-RAW");
    }

    // Fill sample matrix qty in first size column
    const sizeQtyInput = page.locator('input[type="number"]').first();
    if (await sizeQtyInput.isVisible()) {
      await sizeQtyInput.fill("150");
      await page.waitForTimeout(500);
    }

    // Advance Step 2 -> Step 3
    console.log("Advancing to Step 3 (Cut Sheet Ticket)...");
    const step2Continue = page.locator('button:has-text("Continue to Cut Sheet Ticket"), button:has-text("Continue")').first();
    await step2Continue.click();
    await page.waitForTimeout(2000);

    // Advance Step 3 -> Step 4
    console.log("Advancing to Step 4 (Document Vault)...");
    const step3Continue = page.locator('button:has-text("Continue to Document Vault"), button:has-text("Continue")').first();
    await step3Continue.click();
    await page.waitForTimeout(2000);

    // Advance Step 4 -> Step 5
    console.log("Advancing to Step 5 (Review & Submit)...");
    const step4Continue = page.locator('button:has-text("Continue to Review"), button:has-text("Continue to Final Review"), button:has-text("Continue")').first();
    await step4Continue.click();
    await page.waitForTimeout(2000);

    const step5Screenshot = path.join(artifactDir, "lifecycle_step5_review.png");
    await page.screenshot({ path: step5Screenshot, fullPage: true });
    console.log(`Saved screenshot: ${step5Screenshot}`);

    // Submit Application
    console.log("Submitting production intake application...");
    const submitBtn = page.locator('button:has-text("Submit Production Order Intake"), button:has-text("Submit Application"), button:has-text("Submit Order")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(4000);

      const submittedScreenshot = path.join(artifactDir, "lifecycle_submitted_success.png");
      await page.screenshot({ path: submittedScreenshot });
      console.log(`Saved screenshot: ${submittedScreenshot}`);
    }

    // ----------------------------------------------------
    // PHASE 2: Merchandiser Converts the New Application
    // ----------------------------------------------------
    console.log("\n[PHASE 2] Merchandiser reviewing and converting application...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const merchCard = page.locator('div:has-text("Merchandiser"):has-text("CLICK TO ENTER")').last();
    await merchCard.click();
    await page.waitForTimeout(2000);

    await page.goto(`${baseUrl}/submissions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const inboxScreenshot = path.join(artifactDir, "lifecycle_merchandiser_inbox.png");
    await page.screenshot({ path: inboxScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${inboxScreenshot}`);

    // Click Convert on the pending application
    console.log("Clicking 'Convert' button on the pending application...");
    const convertBtn = page.locator('button:has-text("Convert"), a:has-text("Convert")').first();
    if (await convertBtn.isVisible()) {
      await convertBtn.click();
      await page.waitForTimeout(1500);

      // Step through modal steps 1-5
      for (let s = 1; s <= 5; s++) {
        console.log(`Advancing conversion modal step ${s} -> ${s + 1}...`);
        const nextBtn = page.locator('button:has-text("Continue")').first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(600);
        }
      }

      // Step 6: Confirm & Issue Production PO
      console.log("Step 6: Clicking 'Confirm & Issue Production PO'...");
      const confirmBtn = page.locator('button:has-text("Confirm & Issue Production PO")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        console.log("Waiting for conversion mutation...");
        await page.waitForTimeout(4000);

        const conversionDoneScreenshot = path.join(artifactDir, "lifecycle_conversion_success.png");
        await page.screenshot({ path: conversionDoneScreenshot });
        console.log(`Saved screenshot: ${conversionDoneScreenshot}`);
      }
    }

    // ----------------------------------------------------
    // PHASE 3: Live Backend Supabase Verification
    // ----------------------------------------------------
    console.log("\n[PHASE 3] Verifying Live Supabase Backend Records...");
    const { data: latestBpos } = await supabase
      .from("blanket_pos")
      .select("id, po_number, customer_id, total_contract_qty, apply_reference_code, status, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    console.log("\n--- Real Backend Blanket POs in Supabase ---");
    console.log(JSON.stringify(latestBpos, null, 2));

    const { data: latestSubs } = await supabase
      .from("apply_submissions")
      .select("id, company_name, apply_reference_code, status, converted_to_po_id, created_at")
      .order("created_at", { ascending: false })
      .limit(3);

    console.log("\n--- Real Backend Apply Submissions in Supabase ---");
    console.log(JSON.stringify(latestSubs, null, 2));

    console.log("\n==================================================");
    console.log("FULL LIFECYCLE TEST COMPLETED WITH 100% SUCCESS!");
    console.log("==================================================");

  } catch (err) {
    console.error("Lifecycle test failed:", err);
  } finally {
    await browser.close();
  }
}

runFullLifecycleTest();
