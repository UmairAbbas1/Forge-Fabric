const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function findCutTicketsColumns() {
  const possibleColumns = [
    "id",
    "ticket_number",
    "cut_ticket_number",
    "work_order_id",
    "order_id",
    "style_code",
    "style_no",
    "colorway",
    "color",
    "fabric_lot_id",
    "lot_number",
    "marker_name",
    "total_layers",
    "yards_allocated",
    "total_planned_pcs",
    "total_actual_pcs",
    "status",
    "first_cut_approved",
    "size_breakdown",
    "created_at",
    "updated_at"
  ];

  console.log("Testing individual column select against cut_tickets...");
  const validColumns = [];
  const invalidColumns = [];

  for (const col of possibleColumns) {
    const { error } = await supabase.from("cut_tickets").select(col).limit(1);
    if (error) {
      invalidColumns.push({ col, message: error.message });
    } else {
      validColumns.push(col);
    }
  }

  console.log("✅ VALID columns in cut_tickets:", validColumns);
  console.log("❌ INVALID columns in cut_tickets:", invalidColumns);
}

findCutTicketsColumns();
