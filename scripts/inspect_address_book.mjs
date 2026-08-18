import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectAddressBook() {
  const { data, error } = await supabase.from("address_book").select("*");
  if (error) {
    console.error("Error loading address_book:", error.message);
    return;
  }
  console.log(`Found ${data.length} total rows in address_book table:`);
  data.forEach((row, i) => {
    console.log(`[${i + 1}] ID: ${row.id} | Label: "${row.address_label}" | Customer: "${row.customer_name}" | Address: "${row.full_address || row.street_1}"`);
  });
}

inspectAddressBook();
