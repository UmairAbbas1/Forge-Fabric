import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";
const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

async function testUpdateRealColumns() {
  const { data, error } = await supabase
    .from("apply_submissions")
    .update({
      status: "converted",
      converted_to_po_id: "c854719c-b84e-4b39-a417-99245876df53",
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("apply_reference_code", "APP-2026-0069")
    .select();

  console.log("Update with valid columns result:", { data, error });
}

testUpdateRealColumns();
