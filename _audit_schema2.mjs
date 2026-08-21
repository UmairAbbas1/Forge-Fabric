import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  if (authErr) { console.log("auth error", authErr.message); return; }

  const cols1 = ["id","order_id","stage_number","vendor_name","material_type","material_description","dispatched_by_user_id","dispatched_by_name","received_by_user_id","received_by_name","quantity_dispatched","quantity_received","quantity_short","return_qc_status","return_qc_inspection_id","return_qc_notes","transport_method","vehicle_reference","status","facility_location","outsource_po_number","expected_return_date","dispatched_at"];
  const { error: e1 } = await supabase.from("stage_outsourcing_records").select(cols1.join(",")).limit(1);
  console.log("stage_outsourcing_records probe error (null=all columns exist):", e1?.message);

  const cols2 = ["id","outsource_record_id","order_id","stage_number","inspector_id","inspector_name","inspected_qty","passed_qty","failed_qty","rework_qty","defect_notes","photos","result","inspected_at","created_at"];
  const { error: e2 } = await supabase.from("outsource_return_qc").select(cols2.join(",")).limit(1);
  console.log("outsource_return_qc probe error (null=all columns exist):", e2?.message);

  // Try RPC for checkStageAdvancement DB mirror
  const { data: d3, error: e3 } = await supabase.rpc("get_prev_selected_stage", { p_order_id: "FF-2026-WM-02", p_current: 6 });
  console.log("get_prev_selected_stage:", e3?.message, d3);
}
main();
