import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectAqtiv() {
  const { data: comp } = await supabase.from("companies").select("*").ilike("name", "%aqtiv%");
  console.log("Company:", comp);

  const { data: cust } = await supabase.from("customers").select("*").ilike("name", "%aqtiv%");
  console.log("Customer:", cust);

  const { data: cont } = await supabase.from("contacts").select("*").ilike("email", "%aqtiv%");
  console.log("Contact:", cont);

  const { data: prof } = await supabase.from("profiles").select("*").ilike("email", "%aqtiv%");
  console.log("Profile:", prof);
}

inspectAqtiv();
