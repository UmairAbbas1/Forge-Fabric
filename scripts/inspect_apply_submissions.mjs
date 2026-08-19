import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectApplySubmissions() {
  const { data: subs, error } = await supabase
    .from("apply_submissions")
    .select("id, apply_reference_code, company_name, brand_name, contact_name, contact_email, status, created_at");

  if (error) {
    console.error("Error fetching apply_submissions:", error.message);
    return;
  }

  console.log(`Total apply_submissions: ${subs.length}`);
  console.log(subs.map(s => ({
    id: s.id,
    ref: s.apply_reference_code,
    company: s.company_name,
    brand: s.brand_name,
    email: s.contact_email,
    status: s.status
  })));
}

inspectApplySubmissions();
