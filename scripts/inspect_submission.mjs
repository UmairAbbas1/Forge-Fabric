import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";
const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

async function inspectSubmission() {
  const { data, error } = await supabase
    .from("apply_submissions")
    .select("*")
    .eq("apply_reference_code", "APP-2026-0069");

  console.log("APP-2026-0069 in apply_submissions:", data, error);

  const { data: orders, error: oError } = await supabase
    .from("orders")
    .select("*")
    .or("order_id.ilike.%0069%,po_number.ilike.%0069%");

  console.log("Matching orders in orders table:", orders, oError);
}

inspectSubmission();
