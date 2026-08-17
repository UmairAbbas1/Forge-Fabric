const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCutTicketInsert() {
  const generatedTicketNo = `CT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const woId = "FF-2608";

  console.log(`Inserting into cut_tickets with valid fields (cut_number: ${generatedTicketNo}, work_order_id: ${woId})...`);
  const { data, error } = await supabase.from("cut_tickets").insert({
    cut_number: generatedTicketNo,
    work_order_id: woId,
    marker_name: "MK-DENIM-01",
    total_layers: 30,
    status: "In_Progress",
  }).select();

  console.log("Error:", error);
  console.log("Data:", data);
}

testCutTicketInsert();
