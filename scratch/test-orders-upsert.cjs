const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCorrectedUpsert() {
  const activePo = "PO-2026-1855";
  const todayDate = new Date().toISOString().slice(0, 10);
  const numericQty = 5000;
  const newMaterialId = `mat-test-${Date.now()}`;

  console.log(`1. Upserting parent order ${activePo} with lowercase po_number...`);
  const { data: ordData, error: ordErr } = await supabase.from("orders").upsert(
    {
      order_id: activePo,
      customer_name: "Servade",
      po_number: activePo,
      tech_pack_ref: `TP-${activePo.replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}`,
      size_breakdown: "Standard Matrix",
      status: "In Production",
      created_date: todayDate,
      current_stage: 3,
      qty: numericQty,
    },
    { onConflict: "order_id" }
  ).select();

  console.log("Order upsert error:", ordErr);
  console.log("Order upsert data:", ordData);

  console.log(`2. Inserting material ${newMaterialId} for order_id ${activePo}...`);
  const { data: matData, error: matErr } = await supabase.from("materials").insert({
    material_id: newMaterialId,
    order_id: activePo,
    type: "Fabric",
    description: "FAB-17 - denim rolls (Lot: LOT-PO20261855-01)",
    qty_received: numericQty,
    inspection_status: "Pending",
    received_date: todayDate,
  }).select();

  console.log("Material insert error:", matErr);
  console.log("Material insert data:", matData);
}

testCorrectedUpsert();
