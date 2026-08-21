import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  if (authErr) { console.log("auth error", authErr.message); return; }

  const { data, error } = await supabase.from("notifications").select("*").limit(1);
  console.log("notifications columns:", error?.message, data && data[0] ? Object.keys(data[0]) : "no rows, trying insert probe");

  const { data: apply, error: applyErr } = await supabase.from("apply_submissions").select("*").limit(1);
  console.log("apply_submissions columns:", applyErr?.message, apply && apply[0] ? Object.keys(apply[0]) : null);
}
main();
