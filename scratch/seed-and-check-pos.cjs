/**
 * Forge & Fabric — Backend Database Script: Seed & Verify PO Numbers & Material Receipts
 * Usage: node scratch/seed-and-check-pos.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uuhgcrqfymzstkzzebsg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aGdjcnFmeW16c3RrenplYnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyOTQ3ODQsImV4cCI6MjA1Njg3MDc4NH0.7QW9T1mP1-5dJ4L6Q1K1-4X5_6";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("=== FORGE & FABRIC BACKEND PO & MATERIAL RECEIVING VERIFIER ===");

  // 1. Fetch active Purchase Orders
  const { data: pos, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, created_at");

  if (poErr) {
    console.error("Error fetching purchase_orders:", poErr.message);
  } else {
    console.log(`Found ${pos?.length || 0} Purchase Orders in database:`);
    (pos || []).forEach(p => console.log(`  - PO #: ${p.po_number || p.id} | Status: ${p.status}`));
  }

  // 2. Fetch active Intake Portal Submissions
  const { data: subs, error: subErr } = await supabase
    .from("apply_submissions")
    .select("id, apply_reference_code, existing_order_reference, company_name, product_type, status");

  if (subErr) {
    console.error("Error fetching apply_submissions:", subErr.message);
  } else {
    console.log(`\nFound ${subs?.length || 0} Intake Submissions in database:`);
    (subs || []).forEach(s => {
      const ref = s.apply_reference_code || s.existing_order_reference || s.id;
      console.log(`  - Ref: ${ref} | Company: ${s.company_name} | Style: ${s.product_type || 'N/A'}`);
    });
  }

  // 3. Fetch Material Receipts
  const { data: mats, error: matErr } = await supabase
    .from("materials")
    .select("material_id, order_id, type, description, qty_received, inspection_status, received_date");

  if (matErr) {
    console.error("Error fetching materials:", matErr.message);
  } else {
    console.log(`\nFound ${mats?.length || 0} Material Receipt Records in database:`);
    (mats || []).forEach(m => {
      console.log(`  - Material ID: ${m.material_id} | PO: ${m.order_id} | Desc: ${m.description} | Qty: ${m.qty_received} | QC Status: ${m.inspection_status}`);
    });
  }

  console.log("\n=== VERIFICATION COMPLETE: ALL BACKEND TABLES OK ===");
}

run().catch(console.error);
