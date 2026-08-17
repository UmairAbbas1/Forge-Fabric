const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testResilientInsert() {
  const generatedTicketNo = `CT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const selectedWoId = "FF-2608";

  console.log("Testing resilient cut_tickets insert...");
  let insertErr = null;

  // Try full payload first
  const { data: fullData, error: fullErr } = await supabase.from("cut_tickets").insert({
    cut_number: generatedTicketNo,
    ticket_number: generatedTicketNo,
    work_order_id: selectedWoId,
    wo_number: `WO-${selectedWoId}`,
    style_code: "501-RAW-SEL",
    colorway: "Raw Indigo",
    fabric_lot_id: "lot-1",
    lot_number: "LOT-PO20261855-01",
    marker_name: "MK-DENIM-01",
    total_layers: 30,
    yards_allocated: 150,
    total_planned_pcs: 800,
    total_actual_pcs: 0,
    first_cut_approved: false,
    size_breakdown: { "30": 50, "32": 150, "34": 100 },
    status: "In_Progress",
  }).select();

  if (fullErr) {
    console.warn("Full payload warning:", fullErr.message);
    insertErr = fullErr;

    // Fallback: try minimal schema matching PostgreSQL table
    const { data: minData, error: minErr } = await supabase.from("cut_tickets").insert({
      cut_number: generatedTicketNo,
      marker_name: "MK-DENIM-01",
      total_layers: 30,
      status: "In_Progress",
    }).select();

    console.log("Minimal insert error:", minErr);
    console.log("Minimal insert data:", minData);
    insertErr = minErr;
  } else {
    console.log("Full insert succeeded! Data:", fullData);
  }
}

testResilientInsert();
