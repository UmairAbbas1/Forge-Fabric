import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });

  for (const t of ["cut_tickets", "sewing_tickets", "bundles", "sewing_bundles", "cutting_records", "qc_records", "orders"]) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    if (error) {
      console.log(`${t}: ERROR - ${error.message}`);
    } else {
      console.log(`${t}: exists, columns = ${data && data[0] ? Object.keys(data[0]).join(", ") : "(no rows to infer columns, but table exists)"}`);
    }
  }
}
main();
