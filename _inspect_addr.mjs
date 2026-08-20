import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "customer@forgefabric.com",
    password: "password123",
  });
  if (authErr) {
    console.log("auth error", authErr.message);
    return;
  }
  const userId = authData.user.id;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  console.log("profile:", JSON.stringify(profile, null, 2));

  const companyId = profile?.company_id;
  console.log("companyId:", companyId);

  if (companyId) {
    const { data: comp } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
    console.log("company:", JSON.stringify(comp, null, 2));

    const { data: byCompany, error: e1 } = await supabase.from("address_book").select("*").eq("company_id", companyId);
    console.log("address_book by company_id:", e1?.message, JSON.stringify(byCompany, null, 2));
  }

  const { data: all, error: eAll, count } = await supabase.from("address_book").select("id, company_id, customer_name, address_label, is_active", { count: "exact" }).limit(20);
  console.log("address_book sample rows error:", eAll?.message, "count:", count);
  console.log("address_book sample rows:", JSON.stringify(all, null, 2));
}

main();
