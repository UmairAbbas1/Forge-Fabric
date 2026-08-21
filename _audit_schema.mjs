import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  if (authErr) { console.log("auth error", authErr.message); return; }

  const check = async (table, label) => {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    console.log(`\n== ${label} (${table}) ==`);
    console.log("error:", error?.message);
    console.log("columns:", data && data[0] ? Object.keys(data[0]) : "(no rows to infer columns)");
  };

  await check("orders", "orders");
  await check("work_orders", "work_orders");
  await check("apply_submissions", "apply_submissions");
  await check("stage_outsourcing_records", "stage_outsourcing_records");
  await check("outsource_return_qc", "outsource_return_qc");

  // Test get_next_selected_stage RPC existence
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_next_selected_stage", { p_order_id: "FF-2026-WM-02", p_current: 5 });
  console.log("\n== get_next_selected_stage RPC ==");
  console.log("error:", rpcErr?.message, "data:", rpcData);

  const { data: submissionRpc, error: subRpcErr } = await supabase.rpc("get_submission_status_by_reference", { p_reference_code: "APP-2026-0028", p_email: "ahmad234@gmail.com" });
  console.log("\n== get_submission_status_by_reference RPC ==");
  console.log("error:", subRpcErr?.message, "data keys:", submissionRpc ? Object.keys(submissionRpc) : submissionRpc);

  // Check row counts for outsourcing tables
  const { count: sorCount } = await supabase.from("stage_outsourcing_records").select("*", { count: "exact", head: true });
  console.log("\nstage_outsourcing_records row count:", sorCount);
  const { count: qcCount } = await supabase.from("outsource_return_qc").select("*", { count: "exact", head: true });
  console.log("outsource_return_qc row count:", qcCount);
}
main();
