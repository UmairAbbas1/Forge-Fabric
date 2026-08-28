import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const DEFAULT_SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";
const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const artifactDir = "C:\\Users\\Saud Shahid\\.gemini\\antigravity-ide\\brain\\298b9a6a-512f-42e8-8ee8-094df11741da";

async function verifySewingStageAndDashboard() {
  console.log("==================================================");
  console.log("TESTING SEWING STAGE RESOLUTION & REAL-TIME DASHBOARD");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const baseUrl = "http://localhost:8080";

  try {
    // 0. Log in
    console.log("Navigating to /login...");
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    console.log("Logging in as Merchandiser...");
    const merchCard = page.locator('div:has-text("Merchandiser"):has-text("CLICK TO ENTER")').last();
    await merchCard.click();
    await page.waitForTimeout(2000);

    // 1. Check Merchandiser /submissions page
    console.log("Navigating to /submissions...");
    await page.goto(`${baseUrl}/submissions`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const submissionsScreenshot = path.join(artifactDir, "verified_submissions_status.png");
    await page.screenshot({ path: submissionsScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${submissionsScreenshot}`);

    // 2. Check Orders page
    console.log("Navigating to /orders...");
    await page.goto(`${baseUrl}/orders`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const ordersScreenshot = path.join(artifactDir, "verified_orders_stage.png");
    await page.screenshot({ path: ordersScreenshot, fullPage: true });
    console.log(`Saved screenshot: ${ordersScreenshot}`);

    // 3. Query live Supabase apply_submissions to verify APP-2026-0069 is converted
    const { data: subData } = await supabase
      .from("apply_submissions")
      .select("id, apply_reference_code, company_name, status, requested_stages, converted_to_po_id, reviewed_at")
      .eq("apply_reference_code", "APP-2026-0069")
      .single();

    console.log("\n--- Live Supabase Record for APP-2026-0069 ---");
    console.log(JSON.stringify(subData, null, 2));

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
  }
}

verifySewingStageAndDashboard();
