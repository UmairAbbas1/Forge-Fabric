import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@forgefabric.com",
    password: "password123",
  });
  if (authErr) {
    console.log("auth error", authErr.message);
    return;
  }
  const { data: all, error: eAll, count } = await supabase
    .from("address_book")
    .select("id, company_id, customer_name, address_label, is_active, street_1, city", { count: "exact" })
    .limit(20);
  console.log("as admin — address_book error:", eAll?.message, "count:", count);
  console.log(JSON.stringify(all, null, 2));

  const { data: companies } = await supabase.from("companies").select("id, name").ilike("name", "%Levi%");
  console.log("Levi companies:", JSON.stringify(companies, null, 2));
}

main();
