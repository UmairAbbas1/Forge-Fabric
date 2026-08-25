import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const { data: sub } = await supabase.from("apply_submissions").select("id, status, source, created_by_staff_id, existing_order_reference, apply_reference_code, company_name, contact_email").eq("apply_reference_code", "APP-2026-0063").single();
  console.log("Submission:", JSON.stringify(sub, null, 2));

  const { data: nl } = await supabase.from("notification_logs").select("recipient_email, notification_type, subject").eq("related_submission_id", sub.id);
  console.log("Notifications logged:", JSON.stringify(nl, null, 2));
}
main();
