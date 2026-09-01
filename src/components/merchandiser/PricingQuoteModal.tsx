import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calculator, Send, CheckCircle2, AlertTriangle, Zap, Info, Printer, Beaker } from "lucide-react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type { ApplySubmission } from "../../lib/types";
import { useAppData } from "../../hooks/useAppData";
import { useRateCards, type RateCardArticleType } from "../../hooks/useRateCards";
import { useArticleCycleProfiles, useRushMultiplierTiers, getRushMultiplierForTier, type ComplexityTier } from "../../hooks/useRushPricing";
import { useCustomerPricingRules } from "../../hooks/useCustomerPricingRules";
import { useSamplePricingRules } from "../../hooks/useSamplePricingRules";
import { resolveWashCategory, WASH_CATEGORY_LABELS } from "../../lib/wash-compatibility-matrix";
import { checkRushFeasibility } from "../../lib/utils";
import { PrintLayout } from "../apply-portal/PrintLayout";

interface PricingQuoteModalProps {
  submission: ApplySubmission;
  isOpen: boolean;
  onClose: () => void;
  onIssued?: () => void;
}

// Real per-submission quantity, derived the same way as the Active
// Production Orders table (orders.tsx): sum style_blocks[].size_matrix,
// falling back to total_units/estimated_quantity. No hardcoded guess —
// if the submission genuinely has no quantity data yet, this returns 0
// and the field is left for manual entry rather than a fabricated 500.
function computeSubmissionQuantity(submission: ApplySubmission): number {
  const sAny = submission as any;
  const blocks = Array.isArray(sAny.style_blocks) ? sAny.style_blocks : [];
  let blockUnits = 0;
  blocks.forEach((b: any) => {
    let u = Number(b.total_units) || 0;
    const sizeSource = (b.size_matrix && typeof b.size_matrix === 'object')
      ? b.size_matrix
      : (b.size_quantities && typeof b.size_quantities === 'object' ? b.size_quantities : null);
    if (sizeSource) {
      const sum = Object.values(sizeSource).reduce((acc: number, q) => acc + (Number(q) || 0), 0);
      if (sum > 0) u = sum;
    }
    blockUnits += u;
  });
  if (blockUnits > 0) return blockUnits;
  return Number(sAny.total_units) || Number(sAny.estimated_quantity) || 0;
}

/**
 * REQ-07 + Pricing & Rates Engine Phase D: Merchandiser Unit Price
 * Calculator & Quoting Workflow.
 *
 * Formula: Base CMT charge + Washing surcharge + Trims & Packaging labor =
 * subtotal; subtotal + Margin % = Unit Price; that price is then further
 * adjusted by a Rush multiplier and/or a Customer discount (independent
 * multiplicative factors — see the discount-stacking decision recorded in
 * this task); Unit Price × Total Quantity = Total Contract Value.
 *
 * Every cost figure is pre-filled from real, admin-maintained rate_cards /
 * rush_multiplier_tiers / customer_pricing_rules data when a match exists —
 * but stays fully editable, and a field with no matching rate simply stays
 * blank/required rather than ever inventing a number. Sample Requests use
 * the separate, simpler sample_pricing_rules path entirely.
 */
export function PricingQuoteModal({ submission, isOpen, onClose, onIssued }: PricingQuoteModalProps) {
  const firstBlock = Array.isArray((submission as any).style_blocks) ? (submission as any).style_blocks[0] : null;
  const isSample = submission.submission_type === "sample_request" || (submission as any).order_type === "sample_request";
  const isRush = (submission as any).priority === "Rush";
  const articleType = (firstBlock?.product_type || submission.product_type) as RateCardArticleType | undefined;
  const fabricCategory = resolveWashCategory(firstBlock?.fabric_type, firstBlock?.product_type);

  const { orders } = useAppData();
  const { data: rateCards } = useRateCards();
  const { data: cycleProfiles } = useArticleCycleProfiles();
  const { data: rushTiers } = useRushMultiplierTiers();
  const { data: customerRules } = useCustomerPricingRules();
  const { data: sampleRules } = useSamplePricingRules();

  // tenant_config for the same daily-capacity/laundry-buffer/rush-lead-time
  // -reduction figures ConversionModal.tsx already reads (no separate
  // config surface).
  const [tenantCfg, setTenantCfg] = useState({ dailyCapacityUnits: 144_000, laundryBufferDays: 2, rushLeadTimeReductionDays: 7 });
  useEffect(() => {
    if (!isRealSupabase) return;
    supabase
      .from("tenant_config")
      .select("daily_capacity_units, laundry_buffer_days, rush_lead_time_reduction_days")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { daily_capacity_units?: number; laundry_buffer_days?: number; rush_lead_time_reduction_days?: number } | null }) => {
        if (data) {
          setTenantCfg({
            dailyCapacityUnits: data.daily_capacity_units || 144_000,
            laundryBufferDays: data.laundry_buffer_days ?? 2,
            rushLeadTimeReductionDays: data.rush_lead_time_reduction_days ?? 7,
          });
        }
      });
  }, []);

  // Resolve this submission's company_id — apply_submissions only stores
  // company_name (text), while customer_pricing_rules is keyed by the real
  // companies.id FK, same name-match convention price_quotes' own RLS
  // policy already uses.
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => {
    if (!isRealSupabase || !submission.company_name) return;
    supabase
      .from("companies")
      .select("id")
      .ilike("name", submission.company_name)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => setCompanyId(data?.id || null));
  }, [submission.company_name]);

  const [styleName, setStyleName] = useState(firstBlock?.style_name || submission.product_type || "Not Specified");
  const [quantity, setQuantity] = useState<number>(() => computeSubmissionQuantity(submission));
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ quoteNumber: string } | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  // Real, admin-maintained matches for this submission's article/fabric —
  // undefined means genuinely no rate configured for that combination.
  const cmtCard = useMemo(
    () => rateCards?.find((r) => r.is_active && r.article_type === articleType && r.process === "cmt_base" && r.fabric_category === fabricCategory),
    [rateCards, articleType, fabricCategory]
  );
  const washCard = useMemo(
    () => rateCards?.find((r) => r.is_active && r.article_type === articleType && r.process === "wash_surcharge" && r.fabric_category === fabricCategory),
    [rateCards, articleType, fabricCategory]
  );
  const trimsCard = useMemo(
    () => rateCards?.find((r) => r.is_active && r.article_type === articleType && r.process === "trims_packaging" && r.fabric_category === fabricCategory),
    [rateCards, articleType, fabricCategory]
  );
  const cycleProfile = useMemo(
    () => cycleProfiles?.find((p) => p.is_active && p.article_type === articleType),
    [cycleProfiles, articleType]
  );
  
  // The only real source for an article's complexity tier is its
  // article_cycle_profiles row (Settings → Pricing & Rates → Rush
  // Pricing) — apply_submissions/style blocks don't carry a
  // complexity_tier field of their own. null means genuinely not
  // configured yet — never silently defaulted to "Moderate" or any other
  // specific tier that was never actually set up for this article.
  const [selectedComplexityTier, setSelectedComplexityTier] = useState<ComplexityTier | null>(cycleProfile?.complexity_tier || null);

  useEffect(() => {
    setSelectedComplexityTier(cycleProfile?.complexity_tier || null);
  }, [submission, cycleProfile]);

  const activeRushMultiplier = useMemo(
    () => getRushMultiplierForTier(rushTiers, selectedComplexityTier),
    [rushTiers, selectedComplexityTier]
  );
  const today = new Date().toISOString().split("T")[0];
  const activeDiscountRule = useMemo(
    () =>
      companyId
        ? customerRules?.find(
            (r) => r.is_active && r.company_id === companyId && r.effective_from <= today && (!r.effective_until || r.effective_until >= today)
          )
        : undefined,
    [customerRules, companyId, today]
  );
  const sampleRule = useMemo(
    () => sampleRules?.find((r) => r.is_active && r.article_type === articleType),
    [sampleRules, articleType]
  );

  // Manually-entered figures — each still fully editable regardless of
  // whether a rate card was found. A field auto-fills from the matching
  // rate card ONLY until the merchandiser edits it themselves; after that,
  // a live rate change (Phase F realtime) no longer silently overwrites
  // their edit for this quote.
  const [cmtCost, setCmtCost] = useState<number>(0);
  const [washCost, setWashCost] = useState<number>(0);
  const [trimsCost, setTrimsCost] = useState<number>(0);
  const [marginPct, setMarginPct] = useState<number>(0);
  const [cmtManual, setCmtManual] = useState(false);
  const [washManual, setWashManual] = useState(false);
  const [trimsManual, setTrimsManual] = useState(false);
  const [marginManual, setMarginManual] = useState(false);

  useEffect(() => {
    if (isSample || cmtManual) return;
    setCmtCost(cmtCard?.base_rate_usd ?? 0);
  }, [cmtCard, isSample, cmtManual]);
  useEffect(() => {
    if (isSample || marginManual) return;
    setMarginPct(cmtCard?.loaded_margin_percent ?? 0);
  }, [cmtCard, isSample, marginManual]);
  useEffect(() => {
    if (isSample || washManual) return;
    setWashCost(washCard?.base_rate_usd ?? 0);
  }, [washCard, isSample, washManual]);
  useEffect(() => {
    if (isSample || trimsManual) return;
    setTrimsCost(trimsCard?.base_rate_usd ?? 0);
  }, [trimsCard, isSample, trimsManual]);

  // Sample Pricing path — deliberately bypasses rate_cards/rush/discount
  // entirely. Flat fee (once, not per unit) + per-unit rate × quantity.
  const sampleTotal = useMemo(() => {
    if (!sampleRule) return 0;
    return (sampleRule.flat_fee_usd || 0) + (sampleRule.per_unit_rate_usd || 0) * Math.max(0, quantity);
  }, [sampleRule, quantity]);
  const sampleUnitPrice = useMemo(
    () => (quantity > 0 && sampleTotal > 0 ? Math.round((sampleTotal / quantity) * 100) / 100 : 0),
    [sampleTotal, quantity]
  );

  const baseCost = cmtCost + washCost + trimsCost;
  const subtotalWithMargin = useMemo(() => Math.round(baseCost * (1 + marginPct / 100) * 100) / 100, [baseCost, marginPct]);

  // Rush multiplier and customer discount apply as independent
  // multiplicative factors on top of the margin-loaded subtotal — the
  // decision recorded for this feature: order-independent (base × rush ×
  // (1 − discount) gives the same result either order), so both simply
  // apply on top of one another rather than one gating or replacing the
  // other. Neither ever silently applies to the Sample Pricing path.
  const rushMultiplier = !isSample && isRush ? activeRushMultiplier : undefined;
  const discountPct = !isSample ? activeDiscountRule?.discount_percent ?? undefined : undefined;

  const finalUnitPrice = useMemo(() => {
    if (isSample) return sampleUnitPrice;
    let price = subtotalWithMargin;
    if (rushMultiplier) price = price * rushMultiplier;
    if (discountPct) price = price * (1 - discountPct / 100);
    return Math.round(price * 100) / 100;
  }, [isSample, sampleUnitPrice, subtotalWithMargin, rushMultiplier, discountPct]);
  const totalContractValue = useMemo(() => Math.round(finalUnitPrice * quantity * 100) / 100, [finalUnitPrice, quantity]);

  // Rush Feasibility (Phase C) — real backlog + this article's real
  // units_per_shift throughput, not a blanket "rush is always possible"
  // assumption. Only computed for rush, non-sample orders with a matched
  // cycle profile (no profile = no throughput data to check against).
  const activeBacklogUnits = useMemo(
    () => orders.filter((o) => o.current_stage < 13 && o.status !== "Shipped" && !(o as any).is_sample).reduce((sum, o) => sum + (Number(o.qty) || 0), 0),
    [orders]
  );
  const rushFeasibility = useMemo(() => {
    if (isSample || !isRush || !cycleProfile || quantity <= 0) return null;
    return checkRushFeasibility(quantity, activeBacklogUnits, cycleProfile.units_per_shift, tenantCfg.dailyCapacityUnits, tenantCfg.laundryBufferDays, tenantCfg.rushLeadTimeReductionDays);
  }, [isSample, isRush, cycleProfile, quantity, activeBacklogUnits, tenantCfg]);

  // Print Quote (Phase D item 6): reuses PrintLayout + the same
  // body.printing-style-template scoped-print mechanism StyleBlockEditor.tsx
  // uses for templates — shows only this one print block, not the rest of
  // the merchandiser inbox page underneath the modal.
  useEffect(() => {
    if (!showPrint) return;
    document.body.classList.add('printing-style-template');
    const cleanup = () => {
      document.body.classList.remove('printing-style-template');
      setShowPrint(false);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', cleanup);
    };
  }, [showPrint]);

  if (!isOpen) return null;

  const handleIssueQuote = async () => {
    setError("");
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (isSample) {
      if (!sampleRule) {
        setError(`No Sample Pricing rule configured for ${articleType || "this article type"} — add one in Settings → Pricing & Rates → Sample Pricing before quoting.`);
        return;
      }
    } else {
      if (cmtCost <= 0) {
        setError("CMT Base Labor cost is required before a quote can be sent.");
        return;
      }
      if (marginPct <= 0) {
        setError("Factory margin % is required before a quote can be sent.");
        return;
      }
    }
    setIssuing(true);
    try {
      const quoteNumber = `QUO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (isRealSupabase) {
        const { error: insertErr } = await supabase.from("price_quotes").insert({
          quote_number: quoteNumber,
          submission_id: submission.id,
          customer_name: submission.company_name,
          style_name: styleName,
          quantity,
          cmt_unit_cost: isSample ? 0 : cmtCost,
          wash_unit_cost: isSample ? 0 : washCost,
          trims_unit_cost: isSample ? 0 : trimsCost,
          factory_margin_pct: isSample ? 0 : marginPct,
          final_unit_price: finalUnitPrice,
          total_contract_value: totalContractValue,
          status: "Sent_To_Customer",
          issued_by: "Merchandiser",
          rate_card_id: !isSample ? cmtCard?.id || null : null,
          fabric_category: fabricCategory,
          complexity_tier: isRush ? selectedComplexityTier : (cycleProfile?.complexity_tier || null),
          rush_multiplier_applied: rushMultiplier ?? null,
          customer_pricing_rule_id: activeDiscountRule?.id || null,
          customer_discount_percent_applied: discountPct ?? null,
          is_sample: isSample,
          sample_pricing_rule_id: isSample ? sampleRule?.id || null : null,
        });
        if (insertErr) throw insertErr;

        await supabase
          .from("apply_submissions")
          .update({ pricing_status: "Pending_Pricing_Approval", updated_at: new Date().toISOString() })
          .eq("id", submission.id);
      }

      setIssued({ quoteNumber });
      onIssued?.();
    } catch (err: any) {
      setError(err.message || "Failed to issue price quote.");
    } finally {
      setIssuing(false);
    }
  };

  const pricingBreakdownForPrint = {
    isSample,
    baseCmtCost: cmtCost,
    washCost,
    trimsCost,
    marginPercent: marginPct,
    subtotalWithMargin,
    rushMultiplier: rushMultiplier ?? null,
    customerDiscountPercent: discountPct ?? null,
    finalUnitPrice,
    quantity,
    totalContractValue,
    quoteNumber: issued?.quoteNumber,
    quoteStatus: issued ? "Sent_To_Customer" : "Draft",
  };

  return (
    <>
      {/* Portaled straight to document.body — this modal is mounted deep
          inside AppShell's page content (SubmissionsDashboard.tsx, marked
          .no-print at its own root per the established convention), so a
          .print-only-template block rendered in the normal tree would be a
          descendant of that .no-print ancestor and get hidden along with
          it during print. display:none on an ancestor can't be overridden
          by a descendant's CSS — the portal is what actually fixes that,
          not a CSS trick. */}
      {showPrint && createPortal(
        <div className="print-only-template">
          <PrintLayout
            companyName={submission.company_name}
            brandName={submission.brand_name}
            contactName={submission.contact_name}
            contactEmail={submission.contact_email}
            orderType={submission.submission_type}
            referenceCode={submission.apply_reference_code || null}
            styleBlocks={firstBlock ? [firstBlock] : []}
            cutSheetData={{}}
            pricingBreakdown={pricingBreakdownForPrint}
          />
        </div>,
        document.body
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 no-print">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/80 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-purple-600" /> {isSample ? "Sample Pricing Calculator" : "Merchandiser Unit Cost Calculator"}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {submission.company_name} · Ref: <span className="font-mono font-bold">{submission.apply_reference_code || submission.id}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {issued ? (
            <div className="p-8 text-center space-y-3 overflow-y-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-neutral-900">Quote Sent to Customer</h3>
              <p className="text-xs text-neutral-500">
                Quote <span className="font-mono font-bold text-neutral-800">{issued.quoteNumber}</span> now appears as a one-time alert on the customer's dashboard (if they have a portal login) and on their public order status page. Once viewed, it moves permanently to their Finance tab for Accept/Reject.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button onClick={() => setShowPrint(true)} className="px-4 py-2 border border-neutral-300 rounded-lg font-semibold text-xs hover:bg-neutral-100 flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Print Quote
                </button>
                <button onClick={onClose} className="px-5 py-2 bg-neutral-900 text-white rounded-lg font-semibold text-sm hover:bg-neutral-800">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {isSample && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-violet-900 font-bold flex items-center gap-2">
                  <Beaker className="w-4 h-4 shrink-0 text-violet-700" />
                  Sample Request — priced using Sample Pricing rates.
                </div>
              )}

              {!isSample && isRush && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>Rush Order Priority</span>
                    </div>
                    <div className="flex items-center gap-2 font-normal">
                      <span className="text-[11px] text-amber-950 font-semibold">Complexity Tier:</span>
                      <select
                        value={selectedComplexityTier || ""}
                        onChange={(e) => setSelectedComplexityTier((e.target.value || null) as ComplexityTier | null)}
                        className="h-7 px-2 py-0.5 rounded-lg border border-amber-300 bg-white font-semibold text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="" disabled>Select tier...</option>
                        {(["Simple", "Moderate", "Complex"] as ComplexityTier[]).map((tier) => {
                          const mult = getRushMultiplierForTier(rushTiers, tier);
                          return (
                            <option key={tier} value={tier}>
                              {tier} {mult != null ? `(${mult.toFixed(2)}x)` : "(not configured)"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="text-[11px] font-normal text-amber-800 flex items-center gap-1.5 pt-0.5">
                    {!selectedComplexityTier ? (
                      <span>No complexity tier configured for this article yet — set one in Settings → Pricing &amp; Rates → Rush Pricing.</span>
                    ) : activeRushMultiplier != null ? (
                      <>
                        <span>Applied Multiplier:</span>
                        <span className="font-mono font-bold text-amber-950 px-1.5 py-0.5 bg-amber-100 rounded border border-amber-200">
                          {activeRushMultiplier.toFixed(2)}x
                        </span>
                        <span>· automatically factored into final unit price &amp; contract value.</span>
                      </>
                    ) : (
                      <span>No rush multiplier configured for this tier — set one in Settings → Pricing &amp; Rates → Rush Pricing.</span>
                    )}
                  </div>
                  {rushFeasibility && !rushFeasibility.feasible && (
                    <div className="flex items-start gap-1.5 pt-1.5 border-t border-amber-200 text-red-800 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        This quantity isn't realistically achievable on the standard rush turnaround given current backlog and this article's real throughput
                        ({cycleProfile?.units_per_shift.toLocaleString()} units/shift). Earliest realistic ship date:{" "}
                        <strong>{rushFeasibility.earliestAchievableDate.toLocaleDateString()}</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!isSample && activeDiscountRule && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-emerald-700" />
                  Active customer discount: {activeDiscountRule.discount_percent?.toFixed(1)}% (applied below)
                </div>
              )}

              {isSample ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Style / Product</label>
                      <input type="text" value={styleName} onChange={(e) => setStyleName(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-medium" />
                    </div>
                    <div>
                      <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Quantity</label>
                      <input type="number" min={1} value={quantity || ""} placeholder="Enter quantity" onChange={(e) => setQuantity(Number(e.target.value) || 0)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold" />
                    </div>
                  </div>
                  {!sampleRule ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> No Sample Pricing rule configured for {articleType || "this article type"}.
                    </div>
                  ) : (
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-700">
                      Sample Pricing rule for <strong>{articleType}</strong>:{" "}
                      {sampleRule.flat_fee_usd ? `$${sampleRule.flat_fee_usd.toFixed(2)} flat` : ""}
                      {sampleRule.flat_fee_usd && sampleRule.per_unit_rate_usd ? " + " : ""}
                      {sampleRule.per_unit_rate_usd ? `$${sampleRule.per_unit_rate_usd.toFixed(2)}/pc` : ""}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Style / Product</label>
                    <input type="text" value={styleName} onChange={(e) => setStyleName(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-medium" />
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Quantity</label>
                    <input type="number" min={1} value={quantity || ""} placeholder="Enter quantity" onChange={(e) => setQuantity(Number(e.target.value) || 0)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Factory Margin %</label>
                    <input type="number" min={0} max={500} value={marginPct || ""} placeholder="e.g. 20" onChange={(e) => { setMarginManual(true); setMarginPct(Number(e.target.value) || 0); }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold" />
                    {cmtCard && !marginManual && <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">From rate card (CMT Base Labor row)</p>}
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">CMT Base Labor ($/pc)</label>
                    <input type="number" step="0.01" min={0} value={cmtCost || ""} placeholder={cmtCard ? undefined : "Enter cost — no rate card found"} onChange={(e) => { setCmtManual(true); setCmtCost(Number(e.target.value) || 0); }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold" />
                    {cmtCard && !cmtManual ? (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">From rate card · {WASH_CATEGORY_LABELS[fabricCategory]} · eff. {cmtCard.effective_date}</p>
                    ) : !cmtCard ? (
                      <p className="text-[10px] text-amber-700 font-semibold mt-0.5">No matching rate card — manual entry required</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Wash Surcharge ($/pc)</label>
                    <input type="number" step="0.01" min={0} value={washCost || ""} placeholder="0.00 if not applicable" onChange={(e) => { setWashManual(true); setWashCost(Number(e.target.value) || 0); }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold" />
                    {washCard && !washManual && <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">From rate card</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Trims &amp; Packing Surcharge ($/pc)</label>
                    <input type="number" step="0.01" min={0} value={trimsCost || ""} placeholder="0.00 if not applicable" onChange={(e) => { setTrimsManual(true); setTrimsCost(Number(e.target.value) || 0); }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono font-bold" />
                    {trimsCard && !trimsManual && <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">From rate card</p>}
                  </div>
                </div>
              )}

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                {!isSample && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-purple-800 font-semibold">Base Cost (CMT + Wash + Trims)</span>
                      <span className="font-mono font-bold text-purple-900">${baseCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-800 font-semibold">Subtotal + Margin ({marginPct.toFixed(1)}%)</span>
                      <span className="font-mono font-bold text-purple-900">${subtotalWithMargin.toFixed(2)}</span>
                    </div>
                    {rushMultiplier != null && (
                      <div className="flex justify-between">
                        <span className="text-amber-800 font-semibold">× Rush Multiplier</span>
                        <span className="font-mono font-bold text-amber-900">×{rushMultiplier.toFixed(2)}</span>
                      </div>
                    )}
                    {discountPct != null && (
                      <div className="flex justify-between">
                        <span className="text-emerald-800 font-semibold">− Customer Discount</span>
                        <span className="font-mono font-bold text-emerald-900">−{discountPct.toFixed(1)}%</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-sm pt-1.5 border-t border-purple-200">
                  <span className="text-purple-900 font-black">Final Unit Price</span>
                  <span className="font-mono font-black text-purple-900">${finalUnitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-purple-200">
                  <span className="text-purple-800 font-semibold">Total Contract Value</span>
                  <span className="font-mono font-black text-emerald-700">${totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-neutral-300 rounded-lg font-semibold hover:bg-neutral-100">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleIssueQuote}
                  disabled={issuing}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> {issuing ? "Sending..." : "Send Quote to Customer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
