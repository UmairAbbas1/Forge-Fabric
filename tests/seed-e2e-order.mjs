// One-off seed script for the REQ-14/15 Phase 4 E2E run.
// Creates a real `orders` row (selected_stages = Cutting+Sewing+Packing
// pipeline, parked at Stage 5) and a matching `apply_submissions` row
// (requested_stages set, for the public status-tracker check), authenticated
// as the admin demo account so RLS (is_internal_staff()) allows the writes.
// Prints the created order_id / reference_code / contact_email as JSON so
// the Playwright spec can pick them up.
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
const orderId = `E2E-${tag}`;
// Deliberately avoids the word "outsource" in the company name — Part B
// test 7 asserts the public status page contains zero occurrences of that
// word anywhere on the page (Section 4E), and the company's own name is
// legitimately shown there, so a name containing it would false-positive.
const companyName = `E2E Selective Pipeline Co ${tag}`;
const contactEmail = `e2e.outsource.${tag}@example.com`;
const vendorName = `E2E Vendor ${tag}`;
// Cutting & Bundling (5,6) + Fabric Receiving (1,2,3) + Planning (4) +
// Sewing Assembly (7) + Pre-Wash QC (8) + Packing (12) + Final QC (11) +
// Dispatch (13) — no Washing (9) / Finishing (10), matching resolveSelectedStages
// for {cutting_bundling, sewing_assembly, pressing_tagging_packing}.
const selectedStages = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13];

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@forgefabric.com',
    password: 'password123',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  const { error: orderErr } = await supabase.from('orders').insert({
    order_id: orderId,
    customer_name: companyName,
    po_number: `PO-E2E-${tag}`,
    tech_pack_ref: `TP-E2E-${tag}`,
    size_breakdown: '28:60, 30:60',
    status: 'In Production',
    created_date: new Date().toISOString().slice(0, 10),
    current_stage: 5,
    qty: 120,
    style_no: `E2E-STYLE-${tag}`,
    style_description: 'E2E Cut-Sew-Pack Test Style',
    color: 'Deep Indigo',
    selected_stages: selectedStages,
  });
  if (orderErr) throw new Error(`Order insert failed: ${orderErr.message}`);

  // A real admin would log this after receiving outsourced cut panels back
  // from the vendor — cutting_records is the pre-existing, independent gate
  // checkStageAdvancement(toStage=6) already required before REQ-15 existed
  // (a Completed + Approved cutting record). REQ-15's outsource-QC gate is
  // an ADDITIONAL prerequisite layered on top, not a replacement for it, so
  // this row isolates the outsource gate as the only thing left blocking
  // Stage 5 -> 6 for this test.
  const { error: cuttingErr } = await supabase.from('cutting_records').insert({
    cut_id: `CR-E2E-${tag}`,
    order_id: orderId,
    panels_cut: 120,
    size: '28/30',
    color: 'Deep Indigo',
    cutter_used: `${vendorName} (Outsourced)`,
    status: 'Completed',
    first_cut_approval_status: 'Approved',
  });
  if (cuttingErr) throw new Error(`Cutting record insert failed: ${cuttingErr.message}`);

  const { data: subData, error: subErr } = await supabase
    .from('apply_submissions')
    .insert({
      company_name: companyName,
      contact_name: 'E2E Tester',
      contact_email: contactEmail,
      submission_type: 'new_order',
      source: 'apply_portal',
      status: 'converted',
      requested_stages: selectedStages,
    })
    .select('id, apply_reference_code')
    .single();
  if (subErr) throw new Error(`Submission insert failed: ${subErr.message}`);

  const result = {
    orderId,
    tag,
    companyName,
    contactEmail,
    vendorName,
    referenceCode: subData.apply_reference_code,
  };
  writeFileSync(new URL('./.e2e-seed.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error('SEED_FAILED:', err.message);
  process.exit(1);
});
