import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  if (authErr) { console.log("auth error", authErr.message); return; }
  const { data, error } = await supabase.from("orders").select("*").limit(1);
  console.log("sample order columns:", error?.message, data && data[0] ? Object.keys(data[0]) : null);

  const { data: all } = await supabase.from("orders").select("*").ilike("customer_name", "%wies%");
  console.log("WiesMade orders:", JSON.stringify(all, null, 2));
}
main();
