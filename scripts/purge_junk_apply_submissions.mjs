import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const JUNK_SUBMISSION_REFS = [
  "APP-2026-0002",
  "APP-2026-0003",
  "APP-2026-0004",
  "APP-2026-0005",
  "APP-2026-0006",
  "APP-2026-0007",
  "APP-2026-0008",
  "APP-2026-0009",
  "APP-2026-0010",
  "APP-2026-0011",
  "APP-2026-0012",
  "APP-2026-0013",
  "APP-2026-0017",
  "APP-2026-0018",
  "APP-2026-0020",
  "APP-2026-0024",
  "APP-2026-0025"
];

async function purgeJunkSubmissions() {
  console.log("Purging junk test records from apply_submissions & child tables...");

  for (const ref of JUNK_SUBMISSION_REFS) {
    const { data: sub } = await supabase.from("apply_submissions").select("id, company_name").eq("apply_reference_code", ref).single();
    if (sub) {
      console.log(`Deleting ${ref} (${sub.company_name}) and cascading children...`);
      // Delete child records first if any foreign keys exist
      await supabase.from("apply_documents").delete().eq("submission_id", sub.id);
      await supabase.from("apply_materials").delete().eq("submission_id", sub.id);
      await supabase.from("apply_measurements").delete().eq("submission_id", sub.id);
      await supabase.from("apply_line_items").delete().eq("submission_id", sub.id);
      await supabase.from("apply_activity_logs").delete().eq("submission_id", sub.id);
      
      const { error } = await supabase.from("apply_submissions").delete().eq("id", sub.id);
      if (error) {
        console.error(`Error deleting ${ref}:`, error.message);
      } else {
        console.log(`Successfully deleted ${ref}`);
      }
    }
  }

  // Also check if Fear of God needs a professional intake submission
  const { data: fogSub } = await supabase.from("apply_submissions").select("id").eq("company_name", "Fear of God");
  if (!fogSub || fogSub.length === 0) {
    await supabase.from("apply_submissions").insert({
      id: "a3b07384-d113-4f9e-bc43-261622384a99",
      apply_reference_code: "APP-2026-FOG-01",
      company_name: "Fear of God",
      brand_name: "Fear of God Essentials",
      contact_name: "Fear of God Merchandising Lead",
      contact_email: "fearofgod@forgefabric.com",
      status: "converted",
      submission_type: "new_order",
      product_type: "Denim Trucker & Jeans",
      source: "apply_portal",
      estimated_quantity: 2300,
      notes: "Custom Japanese Selvedge Run with Vintage Enzyme Wash"
    });
    console.log("Created official Fear of God intake submission APP-2026-FOG-01");
  }

  // Final check
  const { data: finalSubs } = await supabase
    .from("apply_submissions")
    .select("apply_reference_code, company_name, brand_name, status");

  console.log("\n=== PRISTINE APPLY SUBMISSIONS REMAINING ===");
  console.log(finalSubs);
}

purgeJunkSubmissions();
