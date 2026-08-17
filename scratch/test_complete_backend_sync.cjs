const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCompleteBackendAudit() {
  console.log("====================================================");
  console.log("      FORGE & FABRIC BACKEND REAL-TIME AUDIT        ");
  console.log("====================================================");

  const tables = [
    "orders",
    "apply_submissions",
    "materials",
    "inventory_lots",
    "inventory_items",
    "cut_tickets",
    "bundles",
    "qc_inspections",
    "cartons",
    "blanket_pos",
    "work_orders",
    "profiles",
    "companies"
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const t of tables) {
    try {
      const { data, error, count } = await supabase.from(t).select("*", { count: "exact" }).limit(3);
      if (error) {
        console.error(`❌ Table [${t}]: Error -> ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Table [${t}]: Connected OK. Records Count = ${count ?? data.length}. Sample:`, data.length > 0 ? Object.keys(data[0]).join(", ") : "(Empty Table)");
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Table [${t}]: Exception -> ${err.message}`);
      errorCount++;
    }
  }

  console.log("====================================================");
  console.log(`SUMMARY: ${successCount}/${tables.length} Tables Connected Cleanly.`);
  if (errorCount === 0) {
    console.log("🎉 ALL SUPABASE BACKEND TABLES ARE 100% OPERATIONAL!");
  } else {
    console.warn(`⚠️ Found ${errorCount} table issues to review.`);
  }
  console.log("====================================================");
}

runCompleteBackendAudit();
