// Deploys the F&F Assistant (action engine + assistant) to a hosted n8n (n8n Cloud or self-hosted)
// through n8n's public API. Safe to re-run: existing workflows are updated, not duplicated.
//
//   node automation/n8n/deploy-cloud.cjs
//
// Reads automation/n8n/.n8n-cloud.local (git-ignored, never committed):
//   N8N_URL=https://yourname.app.n8n.cloud
//   N8N_API_KEY=...                         (n8n → Settings → n8n API → Create an API key)
//   APP_ORIGINS=https://your-app.vercel.app (comma-separated sites allowed to use the chat)
//   APP_URL=https://your-app.vercel.app     (optional, used for links in emails)
// Credentials ("Supabase" + "Groq") must already exist in that n8n; they are found automatically.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const cfgFile = path.join(__dirname, ".n8n-cloud.local");
if (!fs.existsSync(cfgFile)) {
  console.error(`Missing ${cfgFile}. Create it with N8N_URL, N8N_API_KEY and APP_ORIGINS (see the top of this file).`);
  process.exit(1);
}
const cfg = Object.fromEntries(fs.readFileSync(cfgFile, "utf8").split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const BASE = String(cfg.N8N_URL || "").replace(/\/$/, "");
if (!BASE || !cfg.N8N_API_KEY) { console.error("N8N_URL and N8N_API_KEY are required."); process.exit(1); }

async function api(method, p, body) {
  const res = await fetch(`${BASE}/api/v1${p}`, {
    method,
    headers: { "X-N8N-API-KEY": cfg.N8N_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function generate(env) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ff-n8n-"));
  execFileSync(process.execPath, [path.join(__dirname, "build-workflows.cjs"), env.supabase, env.smtp || "SMTP_NOT_SET", env.groq],
    { env: { ...process.env, GEN_OUT_DIR: out, EXTRA_ORIGINS: cfg.APP_ORIGINS || "", APP_URL: cfg.APP_URL || "", ENGINE_WORKFLOW_ID: env.engineId || "" }, stdio: "pipe" });
  return (file) => JSON.parse(fs.readFileSync(path.join(out, file), "utf8"));
}

// The public API only accepts these fields on create/update.
const forApi = (wf) => ({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });

async function upsertAndPublish(wf) {
  const found = (await api("GET", `/workflows?name=${encodeURIComponent(wf.name)}&limit=50`)).data || [];
  const existing = found.find((w) => w.name === wf.name && !w.isArchived);
  const saved = existing
    ? await api("PUT", `/workflows/${existing.id}`, forApi(wf))
    : await api("POST", "/workflows", forApi(wf));
  try { await api("POST", `/workflows/${saved.id}/publish`, {}); }
  catch (e) { await api("POST", `/workflows/${saved.id}/activate`); } // older n8n versions
  console.log(`${existing ? "updated" : "created"} + published: ${wf.name} (${saved.id})`);
  return saved.id;
}

(async () => {
  const creds = (await api("GET", "/credentials?limit=100")).data || [];
  const pick = (type) => creds.find((c) => c.type === type);
  const supabase = pick("supabaseApi"), groq = pick("groqApi"), smtp = pick("smtp");
  if (!supabase || !groq) {
    console.error("Create a Supabase credential and a Groq credential in this n8n first. Found: " + (creds.map((c) => `${c.name} (${c.type})`).join(", ") || "none"));
    process.exit(1);
  }
  console.log(`using credentials: ${supabase.name}, ${groq.name}${smtp ? ", " + smtp.name : " (no SMTP yet: email workflows skipped)"}`);

  // 1) Engine first: the assistant needs its ID.
  const engineId = await upsertAndPublish(generate({ supabase: supabase.id, groq: groq.id, smtp: smtp?.id })("05-chat-action-engine.json"));
  // 2) Assistant, pointed at the engine's ID on this n8n.
  const read = generate({ supabase: supabase.id, groq: groq.id, smtp: smtp?.id, engineId });
  await upsertAndPublish(read("04-ops-assistant-agent.json"));
  // 3) Email workflows only when an SMTP credential exists.
  if (smtp) for (const f of ["01-order-shipped-email.json", "02-sla-48h-reminder.json", "03-daily-ops-summary.json"]) await upsertAndPublish(read(f));

  console.log(`\nChat endpoint: ${BASE}/webhook/ff-assistant`);
  console.log(`Set this on Vercel:  VITE_N8N_ASSISTANT_URL=${BASE}/webhook/ff-assistant`);
})().catch((e) => { console.error("DEPLOY FAILED:", e.message); process.exit(1); });
