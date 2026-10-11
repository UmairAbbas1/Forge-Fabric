# Forge & Fabric — n8n automations

| Workflow | Trigger | What it does |
|---|---|---|
| `04-ops-assistant-agent` | Chat panel in the F&F app ("Ask F&F") | AI assistant (Groq). Staff: answers from live data + 6 actions. Customers: their own orders, shipments, quotes, applications + answer a quote / request a change. |
| `05-chat-action-engine` | Called by the assistant | Validates and applies chat changes. Nothing is written until the user confirms with a one-time code. |
| `01-order-shipped-email` | Every 5 min | Emails the customer when a packing list is marked Shipped (needs SMTP) |
| `02-sla-48h-reminder` | Hourly | Reminds merchandisers about applications waiting 48h+ (needs SMTP) |
| `03-daily-ops-summary` | Daily 8 AM (Asia/Karachi) | Emails management a production summary (needs SMTP) |

Email workflows start in **test mode** (Settings node, `testMode = true`): every email goes to `testRecipient` with a banner showing the real recipient. Each send is logged in `notification_logs`, which also prevents duplicates.

## Security model (assistant)
- Every chat message carries the user's F&F login token; n8n verifies it with Supabase Auth. Identity never comes from chat text.
- Customers get a separate assistant whose tools are locked to their own company and run with their own token (Supabase RLS applies too).
- The AI can only **propose** changes. Changes apply only when the user replies `confirm CODE` — handled by code, not by the AI — and are re-checked against fresh data and the user's role.
- Every proposal, confirmation and cancellation is recorded in F&F `audit_logs`.

## Answer quality (ReAct plan)
- **Prompt:** ReAct method (look up, read, answer only from the data) plus strict rules: never invent hold/delay reasons, numbers, dates or names.
- **QA gate (`Clean reply`):** blocks invented order/PO/quote IDs, removes invented excuses ("machine breakdown"...), stops tool loops. `qa_status` on every reply says which rule fired.
- **AI critic (`QA critic`):** a second model (temperature 0) re-checks answers that give reasons/causes; it may only remove unsupported claims.
- **Feedback:** every AI answer is logged in `ai_react_trajectories` (migration `20261010000000_ai_react_telemetry.sql`). Users rate answers with 👍/👎 and a one-line correction in the chat.
- **Learning:** an admin promotes a good correction with `select promote_ai_exemplar('<trace id>');` in the Supabase SQL editor. Promoted corrections are added to the prompt (customers only ever see customer corrections).
  Find candidates: `select id, user_query, final_output, human_correction from ai_react_trajectories where human_rating = -1 and human_correction is not null order by created_at desc;`
- **Benchmark:** `node automation/n8n/eval-benchmark.cjs` (set `DELAY_MS=20000` on the Groq free tier). Customer / QC cases run when `CUSTOMER_EMAIL` / `QC_EMAIL` are set.
- **Models:** `openai/gpt-oss-120b` (main), `openai/gpt-oss-20b` (fallback + critic). Change with `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_JUDGE_MODEL` when building. Llama 3.3 / 3.1 are not enabled on our Groq account.

## Deploy to n8n Cloud (shared by Vercel and the whole team)
1. In n8n Cloud create two credentials: **Supabase** (host `https://myednlgltvpszzcjfrta.supabase.co` + service_role key) and **Groq** (API key).
2. n8n → Settings → **n8n API** → create an API key.
3. Create `automation/n8n/.n8n-cloud.local` (git-ignored):
   ```
   N8N_URL=https://yourname.app.n8n.cloud
   N8N_API_KEY=...
   APP_ORIGINS=https://your-app.vercel.app
   ```
4. Run `node automation/n8n/deploy-cloud.cjs` (safe to re-run; updates instead of duplicating).
5. On Vercel set `VITE_N8N_ASSISTANT_URL=https://yourname.app.n8n.cloud/webhook/ff-assistant` and redeploy.
6. Teammates: put the same `VITE_N8N_ASSISTANT_URL` in their own `.env` — no local n8n needed.

Without `VITE_N8N_ASSISTANT_URL`, production builds hide the chat button; local dev uses `http://localhost:5678`.

## Files
- `build-workflows.cjs` — generates `workflows/*.json`
- `deploy-cloud.cjs` — deploys to a hosted n8n via its API
- `dry-run.cjs`, `dry-run-actions.cjs` — test email logic and chat actions on live data without sending or writing
- `test-assistant.cjs`, `test-chat-ui.cjs` — test the live assistant (API and in-browser)
- `manage-n8n.cjs` — list, inspect, and manage workflows & executions via n8n API
- `last-error.cjs` — show the latest n8n run, node by node (local n8n)
- `eval-benchmark.cjs` — ReAct evaluation benchmark against the live assistant (cancels every change it proposes)

The Supabase service_role key bypasses row-level security. It must only ever live in n8n credentials — never in this repo or the frontend.
