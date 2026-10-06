// Runs the three email workflows' logic against live F&F data WITHOUT sending
// anything, and writes HTML previews. Uses the app's admin login (same data
// the n8n service-role credential would see).
//   node automation/n8n/dry-run.cjs [shipmentLookbackDays=60]
const fs = require("fs");
const path = require("path");
const { DateTime } = require(path.join(process.env.APPDATA, "npm/node_modules/n8n/node_modules/luxon"));
const { createClient } = require("@supabase/supabase-js");

const root = path.join(__dirname, "../..");
const env = fs.readFileSync(path.join(root, ".env"), "utf8");
const sb = createClient(env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim(), env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim());
const lookbackDays = Number(process.argv[2] || 60);

const get = async (t, sel, f) => { let q = sb.from(t).select(sel); if (f) q = f(q); const { data, error } = await q; if (error) throw new Error(t + ": " + error.message); return data || []; };

function run(file, codeNode, datasets) {
  const wf = JSON.parse(fs.readFileSync(path.join(__dirname, "workflows", file), "utf8"));
  const settings = Object.fromEntries(wf.nodes.find(n => n.name === "Settings").parameters.assignments.assignments.map(a => [a.name, a.value]));
  const code = wf.nodes.find(n => n.name === codeNode).parameters.jsCode;
  const $ = (name) => { const items = (name === "Settings" ? [settings] : datasets[name] || []).map(json => ({ json })); return { all: () => items, first: () => items[0] }; };
  return new Function("$", "$now", "DateTime", "console", code)($, DateTime.now(), DateTime, { log: (m) => console.log("   skipped:", m) });
}

(async () => {
  await sb.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });

  const ship = run("01-order-shipped-email.json", "Build shipment emails", {
    "Get recent shipments": await get("packing_lists", "packing_list_number,po_number,customer_name,carrier_name,tracking_reference,tracking_number,shipped_at,total_cartons,total_units,destination_address", q => q.eq("status", "Shipped").gte("shipped_at", DateTime.now().minus({ days: lookbackDays }).toUTC().toISO())),
    "Get orders": await get("orders", "order_id,po_number,customer_name,status,current_stage,apply_reference_code,style_no,color,qty"),
    "Get submission contacts": await get("apply_submissions", "apply_reference_code,contact_name,contact_email"),
    "Get customer accounts": await get("profiles", "email,full_name,customer_name", q => q.eq("role", "customer").eq("status", "active")),
    "Get sent shipment emails": await get("notification_logs", "related_order_id,notification_type", q => q.in("notification_type", ["order_shipped", "order_shipped_test"])),
  });
  console.log(`1) Shipment emails (last ${lookbackDays} days): ${ship.length}`);
  ship.forEach(i => console.log("   ->", i.json.subject, "|", i.json.logRows[0].body));

  const sla = run("02-sla-48h-reminder.json", "Build reminder emails", {
    "Get overdue applications": await get("apply_submissions", "id,apply_reference_code,company_name,submission_type,submitted_at,assigned_merchandiser_id,priority", q => q.in("status", ["pending_review", "under_review"]).lt("submitted_at", DateTime.now().minus({ hours: 48 }).toUTC().toISO())),
    "Get staff": await get("profiles", "id,email,full_name,role", q => q.in("role", ["merchandiser", "admin"]).eq("status", "active")),
    "Get reminders sent today": [],
  });
  console.log(`2) SLA reminder emails: ${sla.length}`);
  sla.forEach(i => console.log("   ->", i.json.subject, "|", i.json.logRows.map(r => r.body).join(" ; ")));

  const daily = run("03-daily-ops-summary.json", "Build summary email", {
    "Get open orders": await get("orders", "order_id,customer_name,status,current_stage,qty,planned_ship_date,priority,hold_reason", q => q.neq("status", "Shipped")),
    "Get pending applications": await get("apply_submissions", "id,apply_reference_code,company_name,submitted_at", q => q.in("status", ["pending_review", "under_review"])),
    "Get shipped yesterday": await get("packing_lists", "po_number,customer_name,total_units,carrier_name", q => q.eq("status", "Shipped").gte("shipped_at", DateTime.now().minus({ hours: 24 }).toUTC().toISO())),
  });
  console.log("3) Daily summary:", daily[0].json.subject, "|", daily[0].json.logRows[0].body);

  const prev = path.join(__dirname, "previews");
  fs.mkdirSync(prev, { recursive: true });
  if (ship[0]) fs.writeFileSync(path.join(prev, "shipment.html"), ship[0].json.html);
  if (sla[0]) fs.writeFileSync(path.join(prev, "sla-reminder.html"), sla[0].json.html);
  fs.writeFileSync(path.join(prev, "daily-summary.html"), daily[0].json.html);
  console.log("Previews written to automation/n8n/previews/");
})().catch(e => { console.error("DRY RUN ERROR:", e.message); process.exit(1); });
