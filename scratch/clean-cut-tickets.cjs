const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanCutTickets() {
  console.log("Fetching existing cut_tickets from Supabase...");
  const { data: ctRows, error: ctFetchErr } = await supabase.from("cut_tickets").select("id, cut_number, created_at");
  if (ctFetchErr) {
    console.error("Error fetching cut_tickets:", ctFetchErr);
  } else {
    console.log(`Found ${ctRows.length} cut_tickets rows in Supabase:`, ctRows);
    if (ctRows.length > 0) {
      console.log("Deleting old cut_tickets...");
      const { data: delData, error: delErr } = await supabase.from("cut_tickets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) console.error("Error deleting cut_tickets:", delErr);
      else console.log("Successfully deleted old cut_tickets from Supabase.");
    }
  }

  console.log("Fetching existing bundles from Supabase...");
  const { data: bndRows, error: bndFetchErr } = await supabase.from("bundles").select("id, bundle_barcode");
  if (bndFetchErr) {
    console.error("Error fetching bundles:", bndFetchErr);
  } else {
    console.log(`Found ${bndRows.length} bundles rows in Supabase:`, bndRows);
    if (bndRows.length > 0) {
      console.log("Deleting old bundles...");
      const { error: delBndErr } = await supabase.from("bundles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delBndErr) console.error("Error deleting bundles:", delBndErr);
      else console.log("Successfully deleted old bundles from Supabase.");
    }
  }

  // Also clean sewing_bundles and cutting_records test entries
  try {
    await supabase.from("sewing_bundles").delete().neq("bundle_id", "___NON_EXISTENT___");
    await supabase.from("cutting_records").delete().neq("cut_id", "___NON_EXISTENT___");
    console.log("Cleaned sewing_bundles and cutting_records test entries.");
  } catch (e) {
    console.warn("Notice cleaning secondary tables:", e);
  }
}

cleanCutTickets();
