const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrders() {
  console.log("Fetching one row from orders...");
  const { data, error } = await supabase.from("orders").select("*").limit(1);
  console.log("Error:", error);
  console.log("Data:", data);

  console.log("Testing insert into orders with minimal columns (order_id)...");
  const testId = `TEST-ORD-${Date.now()}`;
  const { data: insData, error: insErr } = await supabase.from("orders").insert({
    order_id: testId
  }).select();
  console.log("Minimal insert error:", insErr);
  console.log("Minimal insert data:", insData);
}

inspectOrders();
