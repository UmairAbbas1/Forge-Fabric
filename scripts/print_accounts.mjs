import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function printActiveAccounts() {
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, customer_name, status, deactivated")
    .order("role", { ascending: true });

  const active = profs?.filter(p => !p.deactivated && p.customer_name !== 'DEACTIVATED_TEST_ACCOUNT' && p.status !== 'suspended');

  console.log(`\n=== ACTIVE VERIFIED ACCOUNTS (${active?.length} TOTAL) ===`);
  active?.forEach((p, i) => {
    console.log(`[${i+1}] Email: ${p.email.padEnd(30)} | Role: ${p.role.padEnd(14)} | Customer/Brand: ${p.customer_name || '-'}`);
  });
}

printActiveAccounts();
