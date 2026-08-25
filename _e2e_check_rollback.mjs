import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const { data: sub } = await supabase.from("apply_submissions").select("status, converted_to_po_id").eq("apply_reference_code", "APP-2026-0063").single();
  console.log("Submission state:", JSON.stringify(sub, null, 2));
  const { data: pos } = await supabase.from("blanket_pos").select("po_number").eq("apply_reference_code", "APP-2026-0063");
  console.log("Any blanket_pos leaked:", JSON.stringify(pos, null, 2));
}
main();
