const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGrnReceiving() {
  const activePo = "PO-2026-1855";
  const todayDate = new Date().toISOString().slice(0, 10);
  const numericQty = 5000;
  const newMaterialId = `mat-test-${Date.now()}`;

  console.log(`1. Testing auto-upsert for parent order ${activePo}...`);
  try {
    const { data: ord } = await supabase
      .from("orders")
      .select("order_id")
      .or(`order_id.eq.${activePo},PO_number.eq.${activePo}`)
      .maybeSingle();

    let resolvedOrderId = activePo;
    if (ord?.order_id) {
      resolvedOrderId = ord.order_id;
      console.log(`Parent order exists: ${resolvedOrderId}`);
    } else {
      console.log(`Upserting missing parent order ${activePo}...`);
      const { error: upsertErr } = await supabase.from("orders").upsert(
        {
          order_id: activePo,
          customer_name: "Servade",
          PO_number: activePo,
          tech_pack_ref: `TP-${activePo.replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}`,
          size_breakdown: "Standard Matrix",
          status: "Open",
          created_date: todayDate,
          current_stage: 3,
          qty: numericQty,
        },
        { onConflict: "order_id" }
      );
      if (upsertErr) console.warn("Order upsert error:", upsertErr);
      else console.log(`Parent order ${activePo} upserted successfully!`);
    }

    console.log(`2. Testing material insert for material_id: ${newMaterialId}...`);
    const { data: matData, error: matErr } = await supabase.from("materials").insert({
      material_id: newMaterialId,
      order_id: resolvedOrderId,
      type: "Fabric",
      description: "FAB-17 - denim rolls (Lot: LOT-PO20261855-01)",
      qty_received: numericQty,
      inspection_status: "Pending",
      received_date: todayDate,
    }).select();

    if (matErr) {
      console.error("Material insert error:", matErr);
    } else {
      console.log("Material inserted successfully without foreign key error!", matData);
    }
  } catch (err) {
    console.error("Test execution error:", err);
  }
}

testGrnReceiving();
