import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });

  const { data: o, error: oErr } = await supabase.from("orders").select("order_id, priority").limit(3);
  console.log("orders.priority:", oErr ? "MISSING: " + oErr.message : JSON.stringify(o));

  const { data: as1, error: asErr } = await supabase.from("apply_submissions").select("id, priority, rush_multiplier").limit(1);
  console.log("apply_submissions.priority/rush_multiplier:", asErr ? "MISSING: " + asErr.message : JSON.stringify(as1));

  const { data: tc, error: tcErr } = await supabase.from("tenant_config").select("*").limit(1);
  console.log("tenant_config columns:", tcErr ? "MISSING: " + tcErr.message : JSON.stringify(tc));

  const { data: wo, error: woErr } = await supabase.from("work_orders").select("wo_number, priority").limit(1);
  console.log("work_orders.priority:", woErr ? "MISSING: " + woErr.message : JSON.stringify(wo));
}
main();
