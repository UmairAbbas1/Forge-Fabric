import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectAllCurrentData() {
  const { data: profs } = await supabase.from("profiles").select("id, email, full_name, role, customer_name");
  console.log("=== CURRENT PROFILES ===");
  console.log(profs);

  const { data: orders } = await supabase.from("orders").select("order_id, customer_name, status, qty");
  console.log("\n=== CURRENT ORDERS ===");
  console.log(orders);

  const { data: subs } = await supabase.from("apply_submissions").select("id, apply_reference_code, company_name, contact_email, status");
  console.log("\n=== CURRENT APPLY SUBMISSIONS ===");
  console.log(subs);
}

inspectAllCurrentData();
