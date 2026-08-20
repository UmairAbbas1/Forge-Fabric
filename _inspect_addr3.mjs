import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const { data: custProfiles } = await supabase.from("profiles").select("id,email,role,company_id,customer_name").eq("role", "customer");
  console.log("customer profiles:", JSON.stringify(custProfiles, null, 2));
  const { data: companies } = await supabase.from("companies").select("id, name").limit(20);
  console.log("companies:", JSON.stringify(companies, null, 2));
}
main();
