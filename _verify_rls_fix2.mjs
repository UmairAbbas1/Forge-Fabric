import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const admin = createClient(url, key);

async function main() {
  await admin.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });

  const testEmail = `_rls_verify2_${Date.now()}@example.com`;
  const testPassword = "TestPass123!";
  const testClient = createClient(url, key);
  const { data: signUpData, error: signUpErr } = await testClient.auth.signUp({ email: testEmail, password: testPassword });
  if (signUpErr) { console.log("signUp error:", signUpErr.message); return; }
  const userId = signUpData.user.id;

  await admin.from("profiles").upsert({
    id: userId, email: testEmail, role: "customer", company_id: null,
    customer_name: null, full_name: "RLS Verify 2", is_portal_user: true, portal_access_enabled: true, status: "active",
  });
  await testClient.auth.signInWithPassword({ email: testEmail, password: testPassword });

  const tables = [
    "price_quotes","orders","apply_submissions","blanket_pos","notifications","qc_records",
    "materials","work_orders","apply_cut_sheets","apply_documents","bundles","companies",
    "customers","cutting_records","sewing_bundles","wash_batches","sample_requests",
    "sku_mappings","scan_events","profiles","migration_exceptions","rework_logs",
    "stage_outsourcing_records","size_gate_records",
  ];
  for (const t of tables) {
    const { count, error } = await testClient.from(t).select("*", { count: "exact", head: true });
    console.log(`${t}: ${error ? "ERROR: " + error.message : count + " rows visible"}`);
  }

  await admin.from("profiles").delete().eq("id", userId);
}
main().catch(e => console.log("FATAL:", e.message));
