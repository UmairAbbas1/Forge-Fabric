import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const { data: sub } = await supabase.from("apply_submissions").select("id, status, source, existing_order_reference, apply_reference_code").eq("apply_reference_code", "APP-2026-0064").single();
  console.log("New submission:", JSON.stringify(sub, null, 2));
}
main();
