import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectOrdersCustomers() {
  const { data: orders, error } = await supabase.from("orders").select("order_id, customer_name, status");
  if (error) {
    console.error("Error fetching orders:", error.message);
    return;
  }
  const custMap = {};
  orders.forEach(o => {
    const c = o.customer_name || "NULL";
    custMap[c] = (custMap[c] || 0) + 1;
  });

  console.log("Distinct customer names in live Supabase 'orders' table:");
  console.log(custMap);
}

inspectOrdersCustomers();
