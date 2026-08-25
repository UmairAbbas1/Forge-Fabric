import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);
async function main() {
  await supabase.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const { data: ord } = await supabase.from("orders").select("*").eq("order_id", "FF-7004");
  console.log("Found orphaned order:", JSON.stringify(ord, null, 2));
  if (ord && ord.length > 0) {
    await supabase.from("orders").delete().eq("order_id", "FF-7004");
    console.log("Deleted orphaned order FF-7004");
  }
  const { data: po } = await supabase.from("blanket_pos").select("*").eq("po_number", "AQTIV-PO-E2E-002");
  console.log("Found orphaned blanket_po:", JSON.stringify(po, null, 2));
  if (po && po.length > 0) {
    await supabase.from("blanket_pos").delete().eq("po_number", "AQTIV-PO-E2E-002");
    console.log("Deleted orphaned blanket_po");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
