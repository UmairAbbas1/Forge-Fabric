import { createClient } from "@supabase/supabase-js";

const url = "https://myednlgltvpszzcjfrta.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

console.log("Testing Supabase connection to:", url);
const supabase = createClient(url, key);

async function testConn() {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").limit(5);
  console.log("Profiles check:", { count: profiles?.length, error: pErr, profiles });

  const { data: orders, error: oErr } = await supabase.from("orders").select("*").limit(5);
  console.log("Orders check:", { count: orders?.length, error: oErr });

  const { data: customers, error: cErr } = await supabase.from("customers").select("*").limit(5);
  console.log("Customers check:", { count: customers?.length, error: cErr });
}

testConn();
