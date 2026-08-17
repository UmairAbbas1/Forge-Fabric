const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testShopFloorBackend() {
  console.log("=== Testing cut_tickets ===");
  const ctRes = await supabase.from("cut_tickets").insert({
    cut_number: `CT-TEST-${Date.now()}`,
    total_layers: 24,
    planned_pcs: 100,
  }).select();
  console.log("cut_tickets insert:", ctRes.error ? ctRes.error : ctRes.data);

  console.log("=== Testing bundles ===");
  const bndRes = await supabase.from("bundles").insert({
    bundle_barcode: `BND-TEST-${Date.now()}`,
    size: "32",
    quantity: 50,
  }).select();
  console.log("bundles insert:", bndRes.error ? bndRes.error : bndRes.data);
}

testShopFloorBackend();
