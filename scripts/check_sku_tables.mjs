import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkProductMasterTables() {
  const tables = ["styles", "boms", "sku_mappings", "customer_sku_map", "customer_sku_mappings", "sku_map"];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(2);
    if (error) {
      console.log(`❌ ${t}:`, error.message);
    } else {
      console.log(`✅ ${t}: exists with ${data.length} rows`);
    }
  }
}

checkProductMasterTables();
