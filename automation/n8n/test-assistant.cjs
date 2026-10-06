// Talks to the live assistant webhook exactly like the F&F chat panel does.
//   node automation/n8n/test-assistant.cjs "message 1" "message 2" ...
// Signs in as the F&F demo admin. Messages run in one session, in order.
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(path.join(__dirname, "../../.env"), "utf8");
const sb = createClient(env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim(), env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim());
const URL_ = process.env.ASSISTANT_URL || "http://localhost:5678/webhook/ff-assistant";
const email = process.env.TEST_EMAIL || "admin@forgefabric.com";

(async () => {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: process.env.TEST_PASSWORD || "password123" });
  if (error) throw error;
  const sessionId = "test-" + Date.now();
  let lastCode = null;
  const delayMs = Number(process.env.DELAY_MS || 6000);
  for (let msg of process.argv.slice(2)) {
    if (lastCode !== null || msg !== process.argv[2]) await new Promise((r) => setTimeout(r, delayMs));
    msg = msg.replace("{CODE}", lastCode || "NOCODE");
    const t0 = Date.now();
    const res = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatInput: msg, sessionId, accessToken: data.session.access_token }) });
    const body = await res.json().catch(() => ({}));
    const out = String(body.output ?? JSON.stringify(body));
    const m = out.match(/confirm\s+([A-Z0-9]{6})\b/);
    if (m) lastCode = m[1];
    console.log(`\n>>> ${msg}   [${res.status}, ${((Date.now() - t0) / 1000).toFixed(1)}s]\n${out}`);
  }
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
