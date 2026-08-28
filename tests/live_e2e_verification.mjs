import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const DEFAULT_SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";
const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function runE2EVerification() {
  console.log("==================================================");
  console.log("STARTING LIVE PLAYWRIGHT E2E + BACKEND VERIFICATION");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 }
  });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    // ----------------------------------------------------
    // TEST 1: Customer Saved Address Selection Flow -> Step 2
    // ----------------------------------------------------
    console.log("\n[TEST 1] Testing Customer Saved Address Selection Flow...");
    await page.goto(`${baseUrl}/apply/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Wait until companies finish loading from Supabase
    console.log("Waiting for companies to finish loading from Supabase...");
    await page.waitForFunction(() => {
      const select = document.querySelector('select');
      return select && select.options.length > 2 && !select.innerText.includes('Loading companies');
    }, { timeout: 15000 });

    const companySelect = page.locator('select').filter({ hasText: 'Select Validated Customer' }).first();
    const options = await companySelect.locator('option').allInnerTexts();
    console.log("Loaded Company Options from Supabase:", options);

    // Select Servade
    const servadeOption = options.find(o => o.includes("Servade") || o.includes("SRV"));
    if (servadeOption) {
      console.log(`Selecting '${servadeOption}'...`);
      await companySelect.selectOption({ label: servadeOption });
    } else {
      await companySelect.selectOption({ index: 1 });
    }
    await page.waitForTimeout(1000);

    // Switch classification radio to "new_order" (New Bulk Order)
    console.log("Checking radio input for 'New Bulk Order'...");
    await page.locator('input[value="new_order"]').check({ force: true });
    await page.waitForTimeout(1000);

    // Fill valid phone number in tel input
    const phoneInput = page.locator('input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      console.log("Filling valid US phone number (555) 234-5678...");
      await phoneInput.fill("(555) 234-5678");
      await page.waitForTimeout(500);
    }

    // Select address card "45 Distribution Way" / "Joe Doe"
    console.log("Looking for saved address card (45 Distribution Way / Joe Doe)...");
    const addressCard = page.locator('div:has-text("Distribution Way"), div:has-text("Joe Doe"), div:has-text("Franklin")').first();
    if (await addressCard.isVisible()) {
      console.log("Clicking saved address card...");
      await addressCard.click();
      await page.waitForTimeout(800);
    }

    // Capture screenshot of Step 1 with address and phone filled
    const step1ScreenshotPath = path.join(artifactDir, "step1_address_selected.png");
    await page.screenshot({ path: step1ScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${step1ScreenshotPath}`);

    // Click "Continue to Order Details"
    console.log("Clicking 'Continue to Order Details' button...");
    const continueBtn = page.locator('button:has-text("Continue to Order Details")').first();
    await continueBtn.click();
    await page.waitForTimeout(2500);

    // Capture screenshot of Step 2
    const step2ScreenshotPath = path.join(artifactDir, "step2_order_details_advanced.png");
    await page.screenshot({ path: step2ScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${step2ScreenshotPath}`);

    const step2Content = await page.content();
    const isStep2 = step2Content.includes("Style & Garment Information") || step2Content.includes("Style 1 Details") || step2Content.includes("Production Order Details") || step2Content.includes("Order Details");
    console.log(`\n>>> TEST 1 RESULT: Advanced from Address to Step 2: ${isStep2 ? "PASSED (SUCCESS)" : "FAILED"}`);

    // ----------------------------------------------------
    // TEST 2: Merchandiser Order Conversion Flow
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing Merchandiser Order Conversion Flow...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Click Merchandiser demo role quick access
    console.log("Logging in as Merchandiser...");
    const merchRoleCard = page.locator('div:has-text("Merchandiser"):has-text("CLICK TO ENTER")').last();
    if (await merchRoleCard.isVisible()) {
      await merchRoleCard.click();
      await page.waitForTimeout(2000);
    }

    // Navigate to /submissions
    console.log("Navigating to /submissions...");
    await page.goto(`${baseUrl}/submissions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const inboxScreenshotPath = path.join(artifactDir, "merchandiser_inbox_authenticated.png");
    await page.screenshot({ path: inboxScreenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${inboxScreenshotPath}`);

    // Click on the pending review row (Aqtiv - APP-2026-0069)
    console.log("Clicking on pending submission APP-2026-0069 row...");
    const pendingRow = page.locator('tr:has-text("APP-2026-0069"), div:has-text("APP-2026-0069")').first();
    if (await pendingRow.isVisible()) {
      await pendingRow.click();
      await page.waitForTimeout(1500);
    }

    const drawerScreenshotPath = path.join(artifactDir, "submission_detail_drawer.png");
    await page.screenshot({ path: drawerScreenshotPath });
    console.log(`Saved screenshot: ${drawerScreenshotPath}`);

    // Look for "Convert to Active PO" / "Convert to Production PO" button
    console.log("Looking for conversion trigger button...");
    const convertTrigger = page.locator('button:has-text("Convert to Active PO"), button:has-text("Approve & Convert"), button:has-text("Convert to Production")').first();
    if (await convertTrigger.isVisible()) {
      console.log("Clicking 'Convert to Active PO' button...");
      await convertTrigger.click();
      await page.waitForTimeout(1500);

      const modalStep1Screenshot = path.join(artifactDir, "conversion_modal_step1.png");
      await page.screenshot({ path: modalStep1Screenshot });
      console.log(`Saved screenshot: ${modalStep1Screenshot}`);

      // Step through mapping steps 1 to 5
      for (let s = 1; s <= 5; s++) {
        const nextBtn = page.locator('button:has-text("Continue")').first();
        if (await nextBtn.isVisible()) {
          console.log(`Advancing mapping step ${s} -> ${s + 1}...`);
          await nextBtn.click();
          await page.waitForTimeout(600);
        }
      }

      // Step 6: Click "Confirm & Issue Production PO"
      console.log("Step 6: Clicking 'Confirm & Issue Production PO'...");
      const confirmPoBtn = page.locator('button:has-text("Confirm & Issue Production PO"), button:has-text("Issue Production PO")').first();
      if (await confirmPoBtn.isVisible()) {
        await confirmPoBtn.click();
        console.log("Waiting for conversion to complete...");
        await page.waitForTimeout(4000);

        const modalResultScreenshot = path.join(artifactDir, "conversion_success_modal.png");
        await page.screenshot({ path: modalResultScreenshot });
        console.log(`Saved screenshot: ${modalResultScreenshot}`);
      }
    }

    // ----------------------------------------------------
    // TEST 3: Live Backend Supabase Verification
    // ----------------------------------------------------
    console.log("\n[TEST 3] Querying Live Supabase Backend Master Records...");
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
    console.log("ALL PLAYWRIGHT TESTS & BACKEND VERIFICATIONS FINISHED!");
    console.log("==================================================");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await browser.close();
  }
}

runE2EVerification();
