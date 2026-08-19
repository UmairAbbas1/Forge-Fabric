import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SEED_MAPPINGS = [
  {
    customer_sku: "WM-RAW-SLM-01",
    factory_code: "FF-DEN-SLIM-SLV",
    brand_name: "Weissmade",
    style_name: "Japanese Selvedge Slim Jean",
    colorway: "Indigo Rinse"
  }
];

async function insertTestMapping() {
  const { data, error } = await supabase.from("sku_mappings").insert(SEED_MAPPINGS).select();
  if (error) {
    console.error("Insert error:", error.message);
  } else {
    console.log("✅ Inserted successfully:", data);
  }
}

insertTestMapping();
