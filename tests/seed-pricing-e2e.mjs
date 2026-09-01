// One-off seed script for the Pricing & Rates engine E2E run (Phase G).
// Creates real rows across every new table (rate_cards, article_cycle_profiles,
// rush_multiplier_tiers, customer_pricing_rules, sample_pricing_rules) plus
// two companies and six apply_submissions covering every scenario the
// Playwright spec (pricing-engine.spec.js) needs — bulk, feasible rush,
// infeasible rush, customer discount, sample, and no-matching-rate-card.
// Authenticated as the admin demo account (has_module_permission('pricing', *)
// grants admin full access). Writes tests/.e2e-pricing-seed.json for the spec
// to read, same convention as seed-e2e-order.mjs.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const tag = Date.now().toString().slice(-6);

function styleBlock({ id, productType, fabricType, styleName, qty }) {
  return {
    id,
    product_type: productType,
    fabric_type: fabricType,
    style_name: styleName,
    style_number: `E2E-${tag}-${id}`,
    colorway: 'E2E Test Colorway',
    wash_type: '',
    service_scope: 'full_cmt',
    starting_stage: 1,
    size_columns: ['M'],
    size_matrix: { M: qty },
    line_total: qty,
    trims_bom: [],
  };
}

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@forgefabric.com',
    password: 'password123',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  // 1. Companies — reused, not created. public.companies has no INSERT
  // policy for an authenticated (non-anon) session post the RLS security
  // fix (20260901001300_precise_rls_fix.sql only grants anon insert, for
  // the public intake wizard's own pre-account flow); a logged-in admin
  // genuinely cannot create one via the client today. Two existing real
  // companies are used instead — the discount rule added to companyB is
  // fully removed by cleanup-pricing-e2e.mjs afterward, leaving no lasting
  // change to either company's own real data.
  const { data: existingCompanies, error: coErr } = await supabase.from('companies').select('id, name').limit(2);
  if (coErr) throw new Error(`Companies lookup failed: ${coErr.message}`);
  if (!existingCompanies || existingCompanies.length < 2) {
    throw new Error('Need at least 2 existing companies in the database for this seed — none found.');
  }
  const companyA = existingCompanies[0];
  const companyB = existingCompanies[1];
  const companyAName = companyA.name;
  const companyBName = companyB.name;

  // Insert-or-reuse: these 5 tables have no DELETE RLS policy for a
  // finance/admin session by design (never hard-deleted by the app — see
  // 20260901002000_pricing_engine_schema.sql), so cleanup-pricing-e2e.mjs
  // can only deactivate, not remove, a previous run's rows. Re-running this
  // seed script must not fail on the resulting unique-constraint conflicts —
  // it reuses whatever's already there (active, matching) instead.
  async function insertOrReuse(table, row, matchCols, selectCols = 'id') {
    const { data, error } = await supabase.from(table).insert(row).select(selectCols).single();
    if (!error) return data;
    if (error.code !== '23505') throw new Error(`${table} insert failed: ${error.message}`);
    let q = supabase.from(table).select(selectCols).eq('is_active', true);
    for (const col of matchCols) q = q.eq(col, row[col]);
    const { data: existing, error: selErr } = await q.maybeSingle();
    if (selErr || !existing) throw new Error(`${table} insert conflicted but no matching active row found: ${selErr?.message}`);
    return existing;
  }

  // 2. Rate cards — T-Shirt / Knit (bulk + discount + feasible-rush tests)
  const rateCardRows = [
    { article_type: 'T-Shirt', process: 'cmt_base', fabric_category: 'knit', base_rate_usd: 4.5, loaded_margin_percent: 20, effective_date: new Date().toISOString().slice(0, 10) },
    { article_type: 'T-Shirt', process: 'wash_surcharge', fabric_category: 'knit', base_rate_usd: 0.75, loaded_margin_percent: 0, effective_date: new Date().toISOString().slice(0, 10) },
    { article_type: 'T-Shirt', process: 'trims_packaging', fabric_category: 'knit', base_rate_usd: 0.5, loaded_margin_percent: 0, effective_date: new Date().toISOString().slice(0, 10) },
    // Hoodie/Sweatshirt / Woven rate card too, for the infeasible-rush test's
    // itemized breakdown to auto-fill correctly.
    { article_type: 'Hoodie/Sweatshirt', process: 'cmt_base', fabric_category: 'woven', base_rate_usd: 6.0, loaded_margin_percent: 25, effective_date: new Date().toISOString().slice(0, 10) },
  ];
  const rateCards = [];
  for (const row of rateCardRows) {
    rateCards.push(await insertOrReuse('rate_cards', row, ['article_type', 'process', 'fabric_category'], 'id, article_type, process, fabric_category'));
  }

  // 3. Article cycle profiles — T-Shirt Simple/fast (feasible rush),
  // Hoodie/Sweatshirt Complex/slow (infeasible rush for any real quantity
  // against real backlog).
  await insertOrReuse('article_cycle_profiles', { article_type: 'T-Shirt', complexity_tier: 'Simple', units_per_shift: 20000, notes: 'E2E seed' }, ['article_type']);
  await insertOrReuse('article_cycle_profiles', { article_type: 'Hoodie/Sweatshirt', complexity_tier: 'Complex', units_per_shift: 50, notes: 'E2E seed' }, ['article_type']);

  // 4. Rush multiplier tiers
  await insertOrReuse('rush_multiplier_tiers', { complexity_tier: 'Simple', multiplier: 1.3 }, ['complexity_tier']);
  await insertOrReuse('rush_multiplier_tiers', { complexity_tier: 'Complex', multiplier: 1.8 }, ['complexity_tier']);

  // 5. Customer discount rule — Company B only. Not unique-constrained (a
  // company can have multiple rules over time), so this one always inserts
  // fresh rather than reusing — harmless, cleaned up by contact_email-scoped
  // deletion of its dependents plus its own 'E2E seed' notes marker.
  const { data: discountRule, error: cdErr } = await supabase.from('customer_pricing_rules').insert({
    company_id: companyB.id,
    discount_type: 'percent',
    discount_percent: 15,
    effective_from: new Date().toISOString().slice(0, 10),
    notes: 'E2E seed',
  }).select('id').single();
  if (cdErr) throw new Error(`Customer discount rule insert failed: ${cdErr.message}`);

  // 6. Sample pricing rule — Jacket
  await insertOrReuse('sample_pricing_rules', { article_type: 'Jacket', flat_fee_usd: 100, per_unit_rate_usd: 8, notes: 'E2E seed' }, ['article_type']);

  // 7. Submissions — one per scenario
  const submissions = [
    {
      key: 'bulk',
      company_name: companyAName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.bulk.${tag}@example.com`,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'pending_review',
      priority: 'Normal',
      product_type: 'T-Shirt',
      fabric_type: 'Knit',
      style_blocks: [styleBlock({ id: 'sb-bulk', productType: 'T-Shirt', fabricType: 'Knit', styleName: 'E2E Bulk Tee', qty: 500 })],
    },
    {
      key: 'rushFeasible',
      company_name: companyAName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.rushok.${tag}@example.com`,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'pending_review',
      priority: 'Rush',
      product_type: 'T-Shirt',
      fabric_type: 'Knit',
      style_blocks: [styleBlock({ id: 'sb-rush-ok', productType: 'T-Shirt', fabricType: 'Knit', styleName: 'E2E Rush Tee (Feasible)', qty: 500 })],
    },
    {
      key: 'rushInfeasible',
      company_name: companyAName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.rushbad.${tag}@example.com`,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'pending_review',
      priority: 'Rush',
      product_type: 'Hoodie/Sweatshirt',
      fabric_type: 'Woven',
      style_blocks: [styleBlock({ id: 'sb-rush-bad', productType: 'Hoodie/Sweatshirt', fabricType: 'Woven', styleName: 'E2E Rush Hoodie (Infeasible)', qty: 500 })],
    },
    {
      key: 'discount',
      company_name: companyBName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.discount.${tag}@example.com`,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'pending_review',
      priority: 'Normal',
      product_type: 'T-Shirt',
      fabric_type: 'Knit',
      style_blocks: [styleBlock({ id: 'sb-discount', productType: 'T-Shirt', fabricType: 'Knit', styleName: 'E2E Discount Tee', qty: 500 })],
    },
    {
      key: 'sample',
      company_name: companyAName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.sample.${tag}@example.com`,
      submission_type: 'sample_request',
      source: 'apply_portal',
      status: 'pending_review',
      priority: 'Normal',
      product_type: 'Jacket',
      fabric_type: 'Woven',
      style_blocks: [styleBlock({ id: 'sb-sample', productType: 'Jacket', fabricType: 'Woven', styleName: 'E2E Sample Jacket', qty: 4 })],
    },
    {
      key: 'noRateCard',
      company_name: companyAName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.norate.${tag}@example.com`,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'pending_review',
      priority: 'Normal',
      product_type: 'Kidswear',
      fabric_type: 'Other',
      style_blocks: [styleBlock({ id: 'sb-norate', productType: 'Kidswear', fabricType: 'Other', styleName: 'E2E No-Rate-Card Kids Set', qty: 200 })],
    },
    {
      key: 'invoiceReady',
      company_name: companyAName,
      contact_name: 'E2E Tester',
      contact_email: `e2e.pricing.invoice.${tag}@example.com`,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'converted',
      priority: 'Normal',
      product_type: 'T-Shirt',
      fabric_type: 'Knit',
      style_blocks: [styleBlock({ id: 'sb-invoice', productType: 'T-Shirt', fabricType: 'Knit', styleName: 'E2E Invoice Tee', qty: 300 })],
    },
  ];

  const submissionIds = {};
  for (const s of submissions) {
    const { key, ...payload } = s;
    const { data, error } = await supabase.from('apply_submissions').insert(payload).select('id, apply_reference_code').single();
    if (error) throw new Error(`Submission insert failed (${key}): ${error.message}`);
    submissionIds[key] = { id: data.id, referenceCode: data.apply_reference_code };
  }

  // 8. Test 8 (Finance invoice matches quote breakdown): a converted order
  // + an Accepted price_quotes row, linked via apply_reference_code, same
  // as a real merchandiser-issued/customer-accepted/converted flow would
  // produce — seeded directly since driving that whole multi-step flow
  // through the UI is not itself what Phase E's invoice-breakdown display
  // is testing.
  const cmtCard = rateCards.find((r) => r.article_type === 'T-Shirt' && r.process === 'cmt_base');
  const invoiceRef = submissionIds.invoiceReady.referenceCode;
  const invoiceOrderId = `E2E-PRICING-${tag}`;
  const cmtCost = 4.5, washCost = 0.75, trimsCost = 0.5, marginPct = 20;
  const finalUnitPrice = Math.round((cmtCost + washCost + trimsCost) * (1 + marginPct / 100) * 100) / 100;
  const quantity = 300;
  const totalContractValue = Math.round(finalUnitPrice * quantity * 100) / 100;

  const { error: orderErr } = await supabase.from('orders').insert({
    order_id: invoiceOrderId,
    customer_name: companyAName,
    po_number: `PO-E2E-PRICING-${tag}`,
    tech_pack_ref: `TP-E2E-PRICING-${tag}`,
    size_breakdown: `M:${quantity}`,
    status: 'Open',
    created_date: new Date().toISOString().slice(0, 10),
    current_stage: 12,
    qty: quantity,
    style_no: `E2E-PRICING-${tag}`,
    style_description: 'E2E Invoice Test Tee',
    color: 'E2E Test Colorway',
    apply_reference_code: invoiceRef,
  });
  if (orderErr) throw new Error(`Invoice-test order insert failed: ${orderErr.message}`);

  const { data: invoiceQuote, error: quoteErr } = await supabase.from('price_quotes').insert({
    quote_number: `QUO-E2E-${tag}`,
    submission_id: submissionIds.invoiceReady.id,
    customer_name: companyAName,
    style_name: 'E2E Invoice Tee',
    quantity,
    cmt_unit_cost: cmtCost,
    wash_unit_cost: washCost,
    trims_unit_cost: trimsCost,
    factory_margin_pct: marginPct,
    final_unit_price: finalUnitPrice,
    total_contract_value: totalContractValue,
    status: 'Accepted',
    issued_by: 'E2E Seed',
    rate_card_id: cmtCard.id,
    fabric_category: 'knit',
    is_sample: false,
  }).select('id, quote_number').single();
  if (quoteErr) throw new Error(`Invoice-test price_quotes insert failed: ${quoteErr.message}`);

  const result = {
    tag,
    companyA: { id: companyA.id, name: companyAName },
    companyB: { id: companyB.id, name: companyBName },
    discountRuleId: discountRule.id,
    rateCardIds: rateCards.map((r) => r.id),
    submissions: submissionIds,
    invoice: {
      orderId: invoiceOrderId,
      quoteId: invoiceQuote.id,
      quoteNumber: invoiceQuote.quote_number,
      finalUnitPrice,
      totalContractValue,
      quantity,
    },
  };
  writeFileSync(new URL('./.e2e-pricing-seed.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('SEED_FAILED:', err.message);
  process.exit(1);
});
