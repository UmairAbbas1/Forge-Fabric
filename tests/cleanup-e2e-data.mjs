// Removes every E2E- prefixed test order (and its cascading outsource /
// cutting / submission records) created by tests/seed-e2e-order.mjs during
// the Phase 4 E2E run, authenticated as the admin demo account (RLS
// is_internal_staff()).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@forgefabric.com',
    password: 'password123',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  const { data: orders } = await supabase.from('orders').select('order_id').like('order_id', 'E2E-%');
  const orderIds = (orders || []).map((o) => o.order_id);
  console.log('Found E2E test orders still present:', orderIds);

  if (orderIds.length > 0) {
    await supabase.from('outsource_return_qc').delete().in('order_id', orderIds);
    await supabase.from('stage_outsourcing_records').delete().in('order_id', orderIds);
    await supabase.from('cutting_records').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().in('order_id', orderIds);
  }

  // order_id is a plain text reference on these tables (no FK cascade to
  // public.orders), so rows here survive independently of whether the
  // parent order row still exists — queried directly by pattern rather
  // than joined off the (possibly already-deleted) orders list above.
  // recordJump (Advance click) and createRealtimeNotification (advance /
  // hold / status-change events) both wrote rows keyed by order_id during
  // the test run.
  const { data: jumpLogs } = await supabase.from('stage_jump_logs').select('id, order_id').like('order_id', 'E2E-%');
  console.log('Found stage_jump_logs rows:', (jumpLogs || []).length);
  if (jumpLogs && jumpLogs.length > 0) {
    await supabase.from('stage_jump_logs').delete().in('id', jumpLogs.map((r) => r.id));
  }

  const { data: notifs } = await supabase.from('notifications').select('id, order_id').like('order_id', 'E2E-%');
  console.log('Found notifications rows:', (notifs || []).length);
  if (notifs && notifs.length > 0) {
    await supabase.from('notifications').delete().in('id', notifs.map((r) => r.id));
  }

  const { data: subs } = await supabase
    .from('apply_submissions')
    .select('id, company_name')
    .or('company_name.like.E2E Selective Pipeline Co%,company_name.like.E2E Outsource Co%,company_name.like.E2E Wizard Check Co%');
  const subIds = (subs || []).map((s) => s.id);
  console.log('Found E2E test submissions:', subIds.length);
  if (subIds.length > 0) {
    await supabase.from('apply_submissions').delete().in('id', subIds);
  }

  console.log('Cleanup complete.');
}

main().catch((err) => {
  console.error('CLEANUP_FAILED:', err.message);
  process.exit(1);
});
