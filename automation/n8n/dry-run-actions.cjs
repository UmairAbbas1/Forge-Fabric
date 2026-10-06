// Runs the chat action engine's planning logic (Plan reads -> live reads ->
// Plan change) against real F&F data WITHOUT writing anything.
//   node automation/n8n/dry-run-actions.cjs
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const root = path.join(__dirname, "../..");
const env = fs.readFileSync(path.join(root, ".env"), "utf8");
const URL_ = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const wf = JSON.parse(fs.readFileSync(path.join(__dirname, "workflows/05-chat-action-engine.json"), "utf8"));
const code = (name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;

async function plan(headers, input) {
  const trigger = [{ json: input }];
  const $ = (n) => { const items = n === "When called by the assistant" ? trigger : n === "Plan reads" ? readsOut : []; return { all: () => items, first: () => items[0] }; };
  let readsOut = new Function("$", code("Plan reads"))($, null);
  // Execute the reads exactly like the HTTP node: one call per read, rows split into items paired to that read.
  const results = [];
  for (let i = 0; i < readsOut.length; i++) {
    const r = readsOut[i].json;
    if (r.error) continue;
    const res = await fetch(URL_ + "/rest/v1/" + r.table + "?" + new URLSearchParams(r.query), { headers });
    const body = await res.json();
    if (!res.ok) { results.push({ json: { error: body }, pairedItem: { item: i } }); continue; }
    for (const row of body) results.push({ json: row, pairedItem: { item: i } });
  }
  const $2 = (n) => { const items = n === "When called by the assistant" ? trigger : n === "Plan reads" ? readsOut : []; return { all: () => items, first: () => items[0] }; };
  return new Function("$", "$input", code("Plan change"))($2, { all: () => results })[0].json;
}

(async () => {
  const sb = createClient(URL_, KEY);
  const { data } = await sb.auth.signInWithPassword({ email: "admin@forgefabric.com", password: "password123" });
  const headers = { apikey: KEY, Authorization: "Bearer " + data.session.access_token };
  const staff = await (await fetch(URL_ + "/rest/v1/profiles?select=email,role&status=eq.active&role=in.(production,qc,merchandiser)", { headers })).json();
  const prod = staff.find((s) => s.role === "production")?.email;
  const qc = staff.find((s) => s.role === "qc")?.email;
  const mats = await (await fetch(URL_ + "/rest/v1/materials?select=material_id,inspection_status,order_id&order_id=eq.FF-2026-00005", { headers })).json();

  const cases = [
    ["Cut sheet change (admin)", { action: "update_cut_sheet_size", details: '{"submission_ref":"APP-2026-0087","size":"32","quantity":60}', userEmail: "admin@forgefabric.com" }],
    ["Cut sheet change, wrong role (production)", { action: "update_cut_sheet_size", details: '{"submission_ref":"APP-2026-0087","size":"32","quantity":60}', userEmail: prod }],
    ["Cut sheet change, size not on sheet", { action: "update_cut_sheet_size", details: '{"submission_ref":"APP-2026-0087","size":"XXL","quantity":10}', userEmail: "admin@forgefabric.com" }],
    ["Cut sheet change after cutting started", { action: "update_cut_sheet_size", details: '{"submission_ref":"APP-2026-0070","size":"LARGE","quantity":10}', userEmail: "admin@forgefabric.com" }],
    ["Put order on hold", { action: "set_order_hold", details: '{"order_ref":"FF-2026-00005","reason":"Waiting for buyer trim approval"}', userEmail: prod }],
    ["Change ship date", { action: "update_ship_date", details: '{"order_ref":"FF-2026-00005","date":"2026-11-20"}', userEmail: "admin@forgefabric.com" }],
    ["Advance stage (sewing-only pipeline)", { action: "advance_stage", details: '{"order_ref":"FF-2026-00005"}', userEmail: prod }],
    ["Advance a shipped order", { action: "advance_stage", details: '{"order_ref":"FF-2026-00010"}', userEmail: "admin@forgefabric.com" }],
    ["Log QC (qc role)", { action: "log_qc", details: '{"order_ref":"FF-2026-00005","checkpoint":"inline sewing qc","inspected_qty":200,"reject_qty":3,"result":"Pass"}', userEmail: qc }],
    ["Log QC, rejects > inspected", { action: "log_qc", details: '{"order_ref":"FF-2026-00005","checkpoint":"Inline Sewing QC","inspected_qty":10,"reject_qty":30}', userEmail: qc }],
    ["Approve material as non-admin", { action: "set_material_status", details: JSON.stringify({ material_id: mats[0]?.material_id || "none", status: mats[0]?.inspection_status === "Approved" ? "Hold" : "Approved" }), userEmail: prod }],
    ["Unknown user", { action: "advance_stage", details: '{"order_ref":"FF-2026-00005"}', userEmail: "stranger@example.com" }],
    ["Malicious ref", { action: "advance_stage", details: '{"order_ref":"FF-1,status.eq.Open)"}', userEmail: "admin@forgefabric.com" }],
    // ---- customer actions (UmairCO customer account) ----
    ["Customer: change request on own order", { action: "request_order_change", details: '{"ref":"FF-2026-00005","request_type":"delivery_change","details":"Please move delivery to the first week of December."}', userEmail: "umair.abbas@cybersoftna.com" }],
    ["Customer: change request on ANOTHER brand's order (Aqtiv)", { action: "request_order_change", details: '{"ref":"FF-2026-00008","request_type":"quantity_change","details":"Increase quantity by 500 pieces please."}', userEmail: "umair.abbas@cybersoftna.com" }],
    ["Customer: answer ANOTHER brand's quote (Aqtiv)", { action: "respond_to_quote", details: '{"quote_number":"QUO-2026-5006","response":"Accepted"}', userEmail: "umair.abbas@cybersoftna.com" }],
    ["Customer: try a staff action (advance stage)", { action: "advance_stage", details: '{"order_ref":"FF-2026-00005"}', userEmail: "umair.abbas@cybersoftna.com" }],
    ["Staff: try a customer action", { action: "respond_to_quote", details: '{"quote_number":"QUO-2026-5006","response":"Accepted"}', userEmail: "admin@forgefabric.com" }],
  ];
  for (const [label, input] of cases) {
    const r = await plan(headers, { mode: "propose", sessionId: "dry", code: "", ...input });
    console.log("\n### " + label + " -> " + (r.ok ? "WOULD PROPOSE" : "REFUSED"));
    console.log(r.ok ? r.preview + "\n  write: " + r.ops.map((o) => o.method + " " + o.table + " " + JSON.stringify(o.query)).join(" | ") : "  " + r.message);
  }
})().catch((e) => { console.error("ERROR", e); process.exit(1); });
