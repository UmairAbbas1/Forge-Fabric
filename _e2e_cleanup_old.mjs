import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const { data: sub } = await supabase.from("apply_submissions").select("id").eq("apply_reference_code", "APP-2026-0063").single();
  if (sub) {
    await supabase.from("apply_cut_sheets").delete().eq("submission_id", sub.id);
    await supabase.from("apply_documents").delete().eq("submission_id", sub.id);
    await supabase.from("notification_logs").delete().eq("related_submission_id", sub.id);
    await supabase.from("apply_submissions").delete().eq("id", sub.id);
    console.log("Cleaned up old test submission APP-2026-0063 and related rows.");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
