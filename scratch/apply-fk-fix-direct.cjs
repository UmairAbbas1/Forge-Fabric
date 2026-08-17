const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndApply() {
  console.log("1. Testing material insert with a new standalone PO Number (PO-2026-9999)...");
  const testPo = "PO-2026-9999";
  const todayDate = new Date().toISOString().slice(0, 10);
  const testMatId = `mat-check-${Date.now()}`;

  // First auto-ensure parent order using corrected code
  const { error: ordErr } = await supabase.from("orders").upsert(
    {
      order_id: testPo,
      customer_name: "Test Brand",
      po_number: testPo,
      tech_pack_ref: `TP-${testPo}`,
      size_breakdown: "Standard Matrix",
      status: "Open",
      created_date: todayDate,
      current_stage: 3,
      qty: 1000,
    },
    { onConflict: "order_id" }
  );

  console.log("Parent order auto-upsert status:", ordErr ? ordErr.message : "Success (null error)");

  // Insert material
  const { data, error } = await supabase.from("materials").insert({
    material_id: testMatId,
    order_id: testPo,
    type: "Fabric",
    description: "FAB-TEST - Test Denim (Lot: LOT-9999-01)",
    qty_received: 1000,
    inspection_status: "Pending",
    received_date: todayDate,
  }).select();

  if (error) {
    console.error("Material insert failed:", error.message);
  } else {
    console.log("Material insert SUCCEEDED! Data:", data);
  }
}

checkAndApply();
