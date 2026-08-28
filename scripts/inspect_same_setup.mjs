import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  console.log("=== PROFILES ===");
  const { data: profs, error: pErr } = await supabase.from("profiles").select("*");
  if (pErr) console.error("Profiles error:", pErr);
  else console.log(profs);

  console.log("\n=== COMPANIES ===");
  const { data: comps, error: cErr } = await supabase.from("companies").select("*");
  if (cErr) console.error("Companies error:", cErr);
  else console.log(comps);

  console.log("\n=== CUSTOMERS ===");
  const { data: custs, error: cuErr } = await supabase.from("customers").select("*");
  if (cuErr) console.error("Customers error:", cuErr);
  else console.log(custs);

  console.log("\n=== CONTACTS ===");
  const { data: contacts, error: ctErr } = await supabase.from("contacts").select("*");
  if (ctErr) console.error("Contacts error:", ctErr);
  else console.log(contacts);
}

inspect();
