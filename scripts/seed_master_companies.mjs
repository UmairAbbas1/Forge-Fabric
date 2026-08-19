import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MASTER_COMPANIES = [
  {
    id: "9b59d56b-04d0-44da-a729-9e84f40a3471",
    name: "Weissmade",
    code: "WEISS-CUST",
    tax_id: "US-9823145-WM",
    company_type: "Customer",
    status: "Active"
  },
  {
    id: "9b59d56b-04d0-44da-a729-9e84f40a3472",
    name: "Fear of God",
    code: "FOG-CUST",
    tax_id: "US-8712903-FOG",
    company_type: "Customer",
    status: "Active"
  },
  {
    id: "9b59d56b-04d0-44da-a729-9e84f40a3473",
    name: "Servade",
    code: "SRV-CUST",
    tax_id: "US-4491201-SRV",
    company_type: "Customer",
    status: "Active"
  },
  {
    id: "9b59d56b-04d0-44da-a729-9e84f40a3474",
    name: "UmairCO",
    code: "UMAIR-CUST",
    tax_id: "US-5519820-UM",
    company_type: "Customer",
    status: "Active"
  }
];

async function seedMasterCompanies() {
  console.log("Seeding Master Customer Companies with UUIDs into Supabase...");
  
  for (const comp of MASTER_COMPANIES) {
    const { data, error } = await supabase.from("companies").upsert(comp, { onConflict: "id" });
    if (error) {
      console.error(`Error inserting ${comp.name}:`, error.message);
    } else {
      console.log(`✅ Seeded company: ${comp.name} (${comp.code})`);
    }
  }

  const { data: allComps } = await supabase.from("companies").select("*");
  console.log("\n=== ALL COMPANIES IN DATABASE ===");
  console.log(allComps);
}

seedMasterCompanies();
