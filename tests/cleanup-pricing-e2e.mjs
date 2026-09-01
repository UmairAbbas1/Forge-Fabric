// Removes every row created by tests/seed-pricing-e2e.mjs and by the
// pricing-engine.spec.js Playwright run itself (rate cards/tiers/profiles
// created through the admin UI in test 1, plus any price_quotes issued
// during the run), authenticated as the admin demo account. Matches
// everything by the "E2E" naming convention this suite uses throughout
// (E2E Pricing Co / E2E seed / E2E-prefixed style numbers), same approach
// as the existing cleanup-e2e-data.mjs for the REQ-14/15 suite.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';

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

  // Test submissions are identified by their distinguishing e2e.pricing.*
  // contact_email (company_name is a REAL, reused company — see
  // seed-pricing-e2e.mjs — so it can't be used as the E2E marker here).
  const { data: subs } = await supabase.from('apply_submissions').select('id, apply_reference_code, contact_email').like('contact_email', 'e2e.pricing.%');
  console.log('apply_submissions:', (subs || []).length);
  const subRefCodes = (subs || []).map((s) => s.apply_reference_code).filter(Boolean);

  // price_quotes issued during the run (test 2/3/4/8) reference these
  // submissions by submission_id — delete first, before the submissions
  // they point to.
  if (subs && subs.length > 0) {
    const { data: quotes } = await supabase.from('price_quotes').select('id').in('submission_id', subs.map((s) => s.id));
    console.log('price_quotes:', (quotes || []).length);
    if (quotes && quotes.length > 0) {
      await supabase.from('price_quotes').delete().in('id', quotes.map((q) => q.id));
    }
  }

  // orders seeded/converted for the invoice test (test 8), linked back to a
  // test submission via apply_reference_code.
  if (subRefCodes.length > 0) {
    const { data: orders } = await supabase.from('orders').select('order_id').in('apply_reference_code', subRefCodes);
    console.log('orders:', (orders || []).length);
    if (orders && orders.length > 0) {
      await supabase.from('orders').delete().in('order_id', orders.map((o) => o.order_id));
    }
  }

  if (subs && subs.length > 0) {
    await supabase.from('apply_submissions').delete().in('id', subs.map((s) => s.id));
  }

  // customer_pricing_rules: the seeded discount rule carries notes='E2E
  // seed'; test 1's UI-created rule (against Servade, 12%) has no notes
  // field at all, so it's matched by discount_percent + null notes instead.
  const { data: rules } = await supabase.from('customer_pricing_rules').select('id').or('notes.eq.E2E seed,and(discount_percent.eq.12,notes.is.null)');
  console.log('customer_pricing_rules:', (rules || []).length);
  if (rules && rules.length > 0) {
    await supabase.from('customer_pricing_rules').delete().in('id', rules.map((r) => r.id));
  }

  // sample_pricing_rules: seeded Jacket rule (notes='E2E seed') + test 1's
  // UI-created Dress rule.
  const { data: sampleRules } = await supabase.from('sample_pricing_rules').select('id').or('notes.eq.E2E seed,article_type.eq.Dress');
  console.log('sample_pricing_rules:', (sampleRules || []).length);
  if (sampleRules && sampleRules.length > 0) {
    await supabase.from('sample_pricing_rules').delete().in('id', sampleRules.map((r) => r.id));
  }

  // rush_multiplier_tiers: seeded Simple/Complex tiers + test 1's UI-created
  // Moderate tier (this suite never touches Moderate for any other reason,
  // so any Moderate row here is this suite's own).
  const { data: multTiers } = await supabase.from('rush_multiplier_tiers').select('id, complexity_tier').in('complexity_tier', ['Simple', 'Complex', 'Moderate']);
  console.log('rush_multiplier_tiers (Simple/Complex/Moderate):', (multTiers || []).length);
  if (multTiers && multTiers.length > 0) {
    await supabase.from('rush_multiplier_tiers').delete().in('id', multTiers.map((r) => r.id));
  }

  // article_cycle_profiles: seeded T-Shirt/Hoodie profiles (notes='E2E
  // seed') + test 1's UI-created Dress profile.
  const { data: profiles } = await supabase.from('article_cycle_profiles').select('id').or('notes.eq.E2E seed,article_type.eq.Dress');
  console.log('article_cycle_profiles:', (profiles || []).length);
  if (profiles && profiles.length > 0) {
    await supabase.from('article_cycle_profiles').delete().in('id', profiles.map((r) => r.id));
  }

  // rate_cards: seeded T-Shirt/Hoodie/Sweatshirt rows + test 1's UI-created
  // Dress and Shorts rows (Kidswear is deliberately never seeded here — the
  // no-matching-rate-card test's whole point — but included for safety in
  // case a run's test 6 or a future admin session ever adds one).
  const { data: cards } = await supabase.from('rate_cards').select('id').in('article_type', ['T-Shirt', 'Hoodie/Sweatshirt', 'Kidswear', 'Dress', 'Shorts']).gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
  console.log('rate_cards (created in the last 6h for test article types):', (cards || []).length);
  if (cards && cards.length > 0) {
    await supabase.from('rate_cards').delete().in('id', cards.map((r) => r.id));
  }

  // No companies to clean up — seed-pricing-e2e.mjs reuses existing real
  // companies rather than creating new ones (companies has no INSERT
  // policy for an authenticated session), and only ever added a temporary
  // customer_pricing_rules row against them, already removed above.

  const seedFile = new URL('./.e2e-pricing-seed.json', import.meta.url);
  if (existsSync(seedFile)) unlinkSync(seedFile);

  console.log('Pricing E2E cleanup complete.');
}

main().catch((err) => {
  console.error('CLEANUP_FAILED:', err.message);
  process.exit(1);
});
