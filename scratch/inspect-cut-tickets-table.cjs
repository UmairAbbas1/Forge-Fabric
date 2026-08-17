const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCutTickets() {
  console.log("1. Fetching 1 row from cut_tickets...");
  const { data, error } = await supabase.from("cut_tickets").select("*").limit(1);
  console.log("Error:", error);
  console.log("Data:", data);

  console.log("2. Testing minimal insert into cut_tickets to get column schema error or success...");
  const { data: insData, error: insErr } = await supabase.from("cut_tickets").insert({
    ticket_number: `CT-TEST-${Date.now()}`,
    work_order_id: "FF-2608",
  }).select();
  console.log("Insert Error:", insErr);
  console.log("Insert Data:", insData);
}

inspectCutTickets();
