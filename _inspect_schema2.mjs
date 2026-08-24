import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });

  // Try a harmless insert with {} to trigger a "null value in column X violates not-null" error revealing required columns
  for (const t of ["sewing_bundles", "cutting_records"]) {
    const { error } = await supabase.from(t).insert({});
    console.log(`${t} insert({}) error:`, error ? error.message : "no error (all nullable?)");
  }
}
main();
