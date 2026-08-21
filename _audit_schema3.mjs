import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  if (authErr) { console.log("auth error", authErr.message); return; }

  const cols = ["id","order_id","stage_number","vendor_name","material_type","material_description","dispatched_by_user_id","dispatched_by_name","received_by_user_id","received_by_name","quantity_dispatched","quantity_received","quantity_short","return_qc_status","return_qc_inspection_id","return_qc_notes","transport_method","vehicle_reference","status","facility_location","outsource_po_number","expected_return_date","dispatched_at"];
  for (const c of cols) {
    const { error } = await supabase.from("stage_outsourcing_records").select(c).limit(1);
    console.log(c, "->", error ? "MISSING (" + error.message + ")" : "exists");
  }
}
main();
