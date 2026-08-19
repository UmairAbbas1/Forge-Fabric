import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listPublicTables() {
  const tables = [
    "profiles", "orders", "apply_submissions", "apply_documents", "apply_materials",
    "apply_measurements", "apply_line_items", "apply_activity_logs", "packing_lists",
    "address_book", "materials", "cutting", "sewing", "wash", "qc", "cartons", "companies"
  ];

  console.log("Checking table existence in Supabase:");
  for (const t of tables) {
    const { error } = await supabase.from(t).select("*", { head: true, count: "exact" });
    if (error) {
      console.log(`❌ Table '${t}' DOES NOT EXIST or errored: ${error.message}`);
    } else {
      console.log(`✅ Table '${t}' EXISTS!`);
    }
  }
}

listPublicTables();
