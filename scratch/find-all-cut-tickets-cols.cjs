const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMoreCols() {
  const checkCols = [
    "fabric_id", "marker_id", "yards", "allocated_yards", "shade_lot", "cut_ticket_id",
    "created_by", "notes", "qty", "plies", "layers", "planned_qty", "actual_qty", "cut_number",
    "ticket_id", "wo_id", "wo_number", "lot_id"
  ];
  const found = [];
  for (const c of checkCols) {
    const { error } = await supabase.from("cut_tickets").select(c).limit(1);
    if (!error) found.push(c);
  }
  console.log("Additional valid columns in cut_tickets:", found);
}

findMoreCols();
