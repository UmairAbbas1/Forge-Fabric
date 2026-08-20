import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  if (authErr) { console.log("auth error", authErr.message); return; }

  const { data: cartons } = await supabase.from("cartons").select("*").eq("order_id", "FF-2026-WM-02");
  console.log("cartons for WM-02:", JSON.stringify(cartons, null, 2));

  const { data: pls } = await supabase.from("packing_lists").select("*").or("po_number.eq.PO-WM-2026-102,customer_name.eq.WiesMade");
  console.log("packing_lists matching WM-02:", JSON.stringify(pls, null, 2));

  const { data: qc } = await supabase.from("qc").select("*").eq("order_id", "FF-2026-WM-02");
  console.log("qc for WM-02:", JSON.stringify(qc, null, 2));

  const { data: wo } = await supabase.from("work_orders").select("*").eq("order_id", "FF-2026-WM-02");
  console.log("work_orders for WM-02:", JSON.stringify(wo, null, 2));
}
main();
