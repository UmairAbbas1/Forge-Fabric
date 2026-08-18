import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectAll() {
  console.log("=== PROFILES ===");
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  if (pErr) console.error(pErr);
  else {
    console.log(`Total profiles: ${profiles.length}`);
    profiles.forEach((p, i) => {
      console.log(`[${i+1}] ID: ${p.id} | Email: ${p.email} | Role: ${p.role} | Cust: "${p.customer_name}" | Company: "${p.company_name}"`);
    });
  }

  console.log("\n=== COMPANIES ===");
  const { data: companies, error: cErr } = await supabase.from("companies").select("*");
  if (cErr) console.log("Companies error / not found:", cErr.message);
  else {
    console.log(`Total companies: ${companies?.length}`);
    companies?.forEach((c, i) => {
      console.log(`[${i+1}] ID: ${c.id} | Name: "${c.name || c.company_name}"`);
    });
  }

  console.log("\n=== ORDERS (by customer) ===");
  const { data: orders, error: oErr } = await supabase.from("orders").select("order_id, customer_name, PO_number, status");
  if (oErr) console.error(oErr);
  else {
    console.log(`Total orders: ${orders?.length}`);
    orders?.forEach((o, i) => {
      console.log(`[${i+1}] Order: ${o.order_id} | Customer: "${o.customer_name}" | PO: ${o.PO_number} | Status: ${o.status}`);
    });
  }
}

inspectAll();
