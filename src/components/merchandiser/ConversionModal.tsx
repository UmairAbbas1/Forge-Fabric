import { useState, useEffect, useMemo } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Building2,
  FileCheck2,
  RotateCcw,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Package,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
} from "lucide-react";
import type { ApplySubmission, ApplyCutSheet, ApplyDocument, SizeMatrix } from "../../lib/types";
import { useConvertSubmission } from "../../hooks/merchandiser/useConvertSubmission";
import { useAppData } from "../../hooks/useAppData";
import { useArticleCycleProfiles, useRushMultiplierTiers, getRushMultiplierForTier, type ComplexityTier } from "../../hooks/useRushPricing";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { calculateSuggestedShipDate } from "../../lib/utils";
import { buildPipelinePreviewLabels } from "../../lib/service-scope-constants";
import { Gauge } from "lucide-react";

interface ConversionModalProps {
  submission: ApplySubmission;
  cutSheet?: ApplyCutSheet | null;
  documents?: ApplyDocument[];
  isOpen: boolean;
  onClose: () => void;
}

export function ConversionModal({
  submission,
  cutSheet,
  documents = [],
  isOpen,
  onClose,
}: ConversionModalProps) {
  const { convert, conversionState, resetState } = useConvertSubmission();
  const { orders, workOrders } = useAppData();
  // Pricing & Rates engine: the real, complexity-tier-based rush multiplier
  // (rush_multiplier_tiers), replacing the old flat tenant_config.rush_multiplier
  // as the PREFERRED source here — that flat value is now only the last-resort
  // fallback below when no cycle profile/tier is configured for this article.
  const { data: cycleProfiles } = useArticleCycleProfiles();
  const { data: rushTiers } = useRushMultiplierTiers();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [selectedStyleBlockIndex, setSelectedStyleBlockIndex] = useState<number>(0);
  const [newSizeKey, setNewSizeKey] = useState("");

  // REQ-09: Capacity-Based Dynamic Delivery Date Scheduling
  const [capacityConfig, setCapacityConfig] = useState({ dailyCapacityUnits: 144_000, laundryBufferDays: 2, rushMultiplier: 2.0, rushLeadTimeReductionDays: 7 });
  useEffect(() => {
    if (!isRealSupabase) return;
    supabase
      .from("tenant_config")
      .select("daily_capacity_units, laundry_buffer_days, rush_multiplier, rush_lead_time_reduction_days")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { daily_capacity_units?: number; laundry_buffer_days?: number; rush_multiplier?: number; rush_lead_time_reduction_days?: number } | null }) => {
        if (data) {
          setCapacityConfig({
            dailyCapacityUnits: data.daily_capacity_units || 144_000,
            laundryBufferDays: data.laundry_buffer_days ?? 2,
            rushMultiplier: data.rush_multiplier || 2.0,
            rushLeadTimeReductionDays: data.rush_lead_time_reduction_days ?? 7,
          });
        }
      });
  }, []);

  // Form State Pre-populated dynamically from submission & cutSheet
  const [poNumber, setPoNumber] = useState("");
  const [woNumber, setWoNumber] = useState("");
  const [styleName, setStyleName] = useState("");
  const [colorway, setColorway] = useState("");
  const [washType, setWashType] = useState("");
  // True when the pre-filled washType came from the category-appropriate
  // default (useApplySubmission.ts) rather than the customer's own explicit
  // choice — surfaced here so the merchandiser knows to actively confirm
  // it, not just accept it as if it were real customer data.
  const [washTypeIsDefault, setWashTypeIsDefault] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [orderType, setOrderType] = useState<"Bulk" | "Sample" | "Rush">("Bulk");
  const [priority, setPriority] = useState<"Normal" | "Rush">("Normal");
  // null means "no article_cycle_profiles row configured for this article
  // yet" — never silently defaulted to a specific tier name that was never
  // actually set up (see the resolution effect below).
  const [complexityTier, setComplexityTier] = useState<ComplexityTier | null>(null);
  const [rushMultiplier, setRushMultiplier] = useState<number | undefined>(undefined);
  const [startingStage, setStartingStage] = useState<number>(1);
  // REQ-14: the resolved selected_stages pipeline for this style block —
  // drives whether Washing is required (stage 9 present) and, once
  // orders.selected_stages wiring lands (Phase 2), what gets persisted.
  const [selectedStages, setSelectedStages] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const [sizeMatrix, setSizeMatrix] = useState<SizeMatrix>({});
  const [linkDocs, setLinkDocs] = useState(true);
  const [linkCutSheet, setLinkCutSheet] = useState(true);

  // WO number sequential generator (Section 2 fix): factory-internal WO
  // numbers may still be auto-generated, but must come from a real
  // max-existing-number-plus-one query against work_orders and orders, not Math.random().
  const nextWoNumber = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const woPrefix = `WO-${currentYear}-`;
    const ffPrefix = `FF-${currentYear}-`;
    let maxSeq = 0;

    for (const wo of workOrders) {
      if (wo.wo_number?.startsWith(woPrefix)) {
        const seq = parseInt(wo.wo_number.slice(woPrefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }

    for (const ord of orders) {
      if (ord.order_id?.startsWith(ffPrefix)) {
        const seq = parseInt(ord.order_id.slice(ffPrefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
      if (ord.order_id?.startsWith(woPrefix)) {
        const seq = parseInt(ord.order_id.slice(woPrefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }

    return `${woPrefix}${String(maxSeq + 1).padStart(5, "0")}`;
  }, [workOrders, orders]);

  // Dynamic initialization whenever submission or cutSheet changes or modal opens
  useEffect(() => {
    if (!submission || !isOpen) return;

    const styleBlocks =
      submission.style_blocks && Array.isArray(submission.style_blocks) && submission.style_blocks.length > 0
        ? submission.style_blocks
        : null;

    const targetBlock = (styleBlocks && styleBlocks[selectedStyleBlockIndex]) || styleBlocks?.[0];

    // Extract size matrix — no fake denim waist-size fallback. An empty
    // object surfaces the "No size matrix found" warning banner instead of
    // silently seeding sizes that make no sense for non-denim product types.
    let extractedSizes: SizeMatrix = {};
    if (targetBlock?.size_matrix && typeof targetBlock.size_matrix === "object" && Object.keys(targetBlock.size_matrix).length > 0) {
      extractedSizes = { ...targetBlock.size_matrix };
    } else if (
      cutSheet?.sheet_data?.components?.[0]?.size_matrix &&
      Object.keys(cutSheet.sheet_data.components[0].size_matrix).length > 0
    ) {
      extractedSizes = { ...cutSheet.sheet_data.components[0].size_matrix };
    } else if ((submission as any).size_quantities && typeof (submission as any).size_quantities === "object") {
      extractedSizes = { ...(submission as any).size_quantities };
    }
    setSizeMatrix(extractedSizes);

    // Style name / code — no "STYLE-PROD" placeholder. Left empty, the
    // required-field validation below blocks conversion until entered.
    const initialStyle =
      targetBlock?.style_number ||
      targetBlock?.style_name ||
      cutSheet?.style_no ||
      "";
    setStyleName(initialStyle);

    // Colorway — no "Standard Colorway" placeholder.
    const initialColor =
      targetBlock?.colorway ||
      (submission as any).colorway ||
      "";
    setColorway(initialColor);

    // REQ-14: resolved selected_stages for this style block, used both to
    // decide whether Washing is required below and (once orders.selected_stages
    // persistence lands in Phase 2) to set the order's actual pipeline.
    // Falls back to the full 13-stage pipeline for legacy submissions that
    // never captured a service selection — matches the DB column default.
    const resolvedStages: number[] =
      (targetBlock as any)?.selected_stages && Array.isArray((targetBlock as any).selected_stages) && (targetBlock as any).selected_stages.length > 0
        ? (targetBlock as any).selected_stages
        : (submission as any).requested_stages && Array.isArray((submission as any).requested_stages) && (submission as any).requested_stages.length > 0
        ? (submission as any).requested_stages
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    setSelectedStages(resolvedStages);

    // Wash type — no "Standard Finish" placeholder. If washing (stage 9)
    // isn't part of this order's pipeline, "N/A — Not Selected" is a real
    // fact derived from the customer's actual service selection, not a
    // fabricated default, so it's set directly and skips required validation.
    const washNeeded = resolvedStages.includes(9);
    if (washNeeded) {
      const initialWash =
        targetBlock?.wash_type ||
        cutSheet?.sheet_data?.wash_type ||
        cutSheet?.wash_dx_cd ||
        (submission as any).wash_type ||
        "";
      setWashType(initialWash);
      setWashTypeIsDefault(Boolean(targetBlock?.wash_type && (targetBlock as any)?.wash_type_is_default));
    } else {
      setWashType("N/A — Not Selected");
      setWashTypeIsDefault(false);
    }

    // PO Number — only ever pre-filled from a real customer-supplied
    // reference. No synthesized PO-2026-XXXX; left empty, required
    // validation blocks conversion until the merchandiser enters the real one.
    setPoNumber(submission.existing_order_reference || "");

    // WO Number — factory-internal, so auto-generation stays acceptable, but
    // it must be a real sequential number, not a random one. Queries the
    // live work_orders table for the highest existing WO-{year}-##### and
    // increments — see nextWoNumber below.
    setWoNumber(nextWoNumber);

    // Due Date — only pre-filled from real submission data. No 45-day
    // guess; left empty, required validation blocks conversion. The
    // REQ-09 capacity-calculator "Suggested" button (below) offers a
    // computed alternative instead of a hardcoded default.
    const initialDue =
      (submission as any).planned_ship_date ||
      (submission as any).due_date ||
      "";
    setDueDate(initialDue);

    // Order Type & Priority — pre-filled from the customer's actual intake
    // selection (apply_submissions.priority/complexity_tier/rush_multiplier), not defaulted
    // to Normal. The merchandiser can still override in Step 4.
    setOrderType(submission.submission_type === "sample_request" ? "Sample" : "Bulk");
    const resolvedPriority: "Normal" | "Rush" = (targetBlock as any)?.priority || (submission as any).priority || "Normal";
    setPriority(resolvedPriority);
    
    // Complexity tier: the ONLY real source is this article's configured
    // article_cycle_profiles row (Settings → Pricing & Rates → Rush
    // Pricing) — apply_submissions/style blocks don't carry their own
    // complexity_tier field. null (not a hardcoded "Moderate") means no
    // profile is configured yet for this article; the dropdown below
    // prompts the merchandiser to pick one rather than silently pretending
    // a real one was found.
    const articleTypeForRush = targetBlock?.product_type;
    const cycleProfile = cycleProfiles?.find((p) => p.is_active && p.article_type === articleTypeForRush);
    const resolvedComplexity: ComplexityTier | null = cycleProfile?.complexity_tier || null;
    setComplexityTier(resolvedComplexity);

    const tieredMultiplier = getRushMultiplierForTier(rushTiers, resolvedComplexity);
    setRushMultiplier(
      resolvedPriority === "Rush"
        ? (submission as any).rush_multiplier || tieredMultiplier
        : undefined
    );

    // Starting Stage — no 4-way service_scope switch. Set from the resolved
    // selected_stages pipeline's first element (still manually overridable
    // in Step 4 below).
    setStartingStage(resolvedStages[0] ?? targetBlock?.starting_stage ?? (submission as any).starting_stage ?? 1);

    setActiveStep(1);
    resetState();
    // nextWoNumber intentionally excluded: it's read via closure at the
    // moment this effect fires (modal open / submission change). Including
    // it would re-run this whole initializer — wiping any in-progress
    // merchandiser edits — every time the background work_orders query
    // refetches, which is unrelated to the user's editing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // cycleProfiles/rushTiers included: both load asynchronously and may
    // still be empty the first time this effect runs (e.g. the modal opens
    // before those queries resolve) — without them here, the complexity
    // tier/multiplier resolved above would get stuck on that first,
    // possibly-empty snapshot and never self-correct once the real data
    // arrives a moment later.
  }, [submission, cutSheet, isOpen, selectedStyleBlockIndex, cycleProfiles, rushTiers]);

  if (!isOpen) return null;

  const totalQty = Object.values(sizeMatrix).reduce((a, b) => a + (Number(b) || 0), 0);

  // REQ-09: active backlog = total units across all orders not yet dispatched (stage < 13)
  // Sample orders (is_sample) excluded — a 3-10pc sample run shouldn't eat
  // into bulk capacity scheduling the way a real production order does.
  const activeBacklogUnits = orders.filter((o) => o.current_stage < 13 && o.status !== "Shipped" && !(o as any).is_sample).reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
  const capacitySuggestion = calculateSuggestedShipDate(
    totalQty,
    activeBacklogUnits,
    capacityConfig.dailyCapacityUnits,
    capacityConfig.laundryBufferDays,
    new Date(),
    priority === "Rush" ? capacityConfig.rushLeadTimeReductionDays : 0
  );

  // Section 2 hardcode-elimination: required-field validation replacing the
  // removed fallbacks. washType is only required when this order's resolved
  // pipeline actually includes washing (stage 9) — otherwise it was already
  // set to the real "N/A — Not Selected" value above, not left blank.
  const washRequired = selectedStages.includes(9);
  const pipelinePreviewLabels = buildPipelinePreviewLabels(selectedStages);
  const requiredFieldErrors: string[] = [];
  if (Object.keys(sizeMatrix).length === 0) requiredFieldErrors.push("No size matrix found — enter sizes manually.");
  else if (totalQty <= 0) requiredFieldErrors.push("At least one size quantity must be greater than zero.");
  if (!styleName.trim()) requiredFieldErrors.push("Style Name / Code is required.");
  if (!colorway.trim()) requiredFieldErrors.push("Colorway is required.");
  if (washRequired && !washType.trim()) requiredFieldErrors.push("Wash Process Formula is required for orders that include washing.");
  if (!poNumber.trim()) requiredFieldErrors.push("PO Number is required.");
  if (!dueDate.trim()) requiredFieldErrors.push("Factory Due Date is required.");
  const hasRequiredFieldErrors = requiredFieldErrors.length > 0;

  const handleSizeChange = (sz: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setSizeMatrix((prev) => ({ ...prev, [sz]: num }));
  };

  const handleAddSize = () => {
    if (!newSizeKey.trim()) return;
    const cleanKey = newSizeKey.trim().toUpperCase();
    if (sizeMatrix[cleanKey] !== undefined) return;
    setSizeMatrix((prev) => ({ ...prev, [cleanKey]: 0 }));
    setNewSizeKey("");
  };

  const handleRemoveSize = (sz: string) => {
    setSizeMatrix((prev) => {
      const next = { ...prev };
      delete next[sz];
      return next;
    });
  };

  const handleExecuteConversion = async () => {
    if (hasRequiredFieldErrors) return;
    try {
      await convert({
        submission_id: submission.id,
        company_name: submission.company_name,
        contact_email: submission.contact_email,
        customer_id: (submission as any).user_id || (submission as any).customer_id,
        po_number: poNumber,
        contract_quantity: totalQty,
        wo_number: woNumber,
        style_name: styleName,
        colorway,
        wash_process_type: washType,
        due_date: dueDate,
        order_type: orderType,
        priority,
        complexity_tier: priority === "Rush" ? (complexityTier ?? undefined) : undefined,
        rush_multiplier: priority === "Rush" ? rushMultiplier : undefined,
        size_breakdown: sizeMatrix,
        gate_1_planned_sizes: sizeMatrix,
        link_documents: linkDocs,
        link_cut_sheet: linkCutSheet,
        starting_stage: startingStage,
        service_scope: (submission as any).service_scope,
        selected_stages: selectedStages,
        apply_reference_code: submission.apply_reference_code,
      });
    } catch (err) {
      console.error("Conversion failed:", err);
    }
  };

  const steps = [
    "1. Review & Map",
    "2. Customer Profile",
    "3. Blanket PO",
    "4. Work Order",
    "5. Gate 1 Sizes",
    "6. Doc & Cut Links",
  ];

  const styleBlocks =
    submission.style_blocks && Array.isArray(submission.style_blocks) && submission.style_blocks.length > 0
      ? submission.style_blocks
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-sky-500" />
              Convert Customer Application to Production Order
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Ref: <span className="font-mono font-bold text-neutral-800">{submission.apply_reference_code || submission.id}</span> · {submission.company_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="px-6 py-2.5 bg-neutral-100/80 border-b border-neutral-200 flex items-center justify-between text-xs overflow-x-auto gap-1">
          {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = activeStep > stepNum;
            const isCurrent = activeStep === stepNum;
            return (
              <button
                key={label}
                type="button"
                onClick={() => !conversionState.isConverting && setActiveStep(stepNum)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap text-xs ${
                  isCurrent
                    ? "bg-sky-500 text-white font-semibold shadow-xs"
                    : isCompleted
                    ? "text-emerald-700 bg-emerald-50 font-medium"
                    : "text-neutral-500 hover:bg-neutral-200/60"
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Ongoing Conversion State */}
          {conversionState.isConverting && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-900">
                  Converting Application ({conversionState.step}/{conversionState.totalSteps})
                </p>
                <p className="text-neutral-500">{conversionState.currentStepLabel}</p>
              </div>
            </div>
          )}

          {/* Error Notification */}
          {!conversionState.isConverting && conversionState.error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Conversion Failed
              </div>
              <p className="text-rose-700 text-xs">{conversionState.error}</p>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExecuteConversion}
                  className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Conversion
                </button>
                <button
                  type="button"
                  onClick={resetState}
                  className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-lg hover:bg-rose-100/50"
                >
                  Edit Configuration
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {!conversionState.isConverting && conversionState.result && (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900">Order Successfully Converted!</h3>
                <p className="text-neutral-500">
                  Blanket PO <span className="font-mono font-bold text-neutral-800">{conversionState.result.po_number}</span> and Work Order <span className="font-mono font-bold text-neutral-800">{conversionState.result.wo_number}</span> have been created in the production pipeline.
                </p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 max-w-md mx-auto text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Blanket PO:</span>
                  <span className="font-mono font-bold text-neutral-800">{conversionState.result.po_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Work Order:</span>
                  <span className="font-mono font-bold text-neutral-800">{conversionState.result.wo_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Contract Qty:</span>
                  <span className="font-bold text-emerald-700">{totalQty} pcs</span>
                </div>
              </div>
              <div className="pt-3 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-neutral-900 text-white rounded-lg font-semibold hover:bg-neutral-800"
                >
                  Done & Close
                </button>
              </div>
            </div>
          )}

          {/* Multi-Style Block Selector Header (if intake contains multiple styles) */}
          {!conversionState.isConverting && !conversionState.result && styleBlocks.length > 1 && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  Intake Contains {styleBlocks.length} Style Blocks:
                </span>
                <span className="text-[11px] text-sky-700">Select style to configure</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {styleBlocks.map((sb, idx) => (
                  <button
                    key={sb.id || idx}
                    type="button"
                    onClick={() => setSelectedStyleBlockIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      selectedStyleBlockIndex === idx
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-white text-sky-800 border border-sky-300 hover:bg-sky-100/60"
                    }`}
                  >
                    Style {idx + 1}: {sb.style_number || sb.style_name || `Block #${idx + 1}`} ({sb.line_total || Object.values(sb.size_matrix || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0)} pcs)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Review & Map */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 1 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-600" />
                Review Intake Submission Data
              </h4>
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-neutral-500 block">Company / Brand:</span>
                  <span className="font-semibold text-neutral-900">{submission.company_name} {submission.brand_name ? `(${submission.brand_name})` : ""}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Contact:</span>
                  <span className="font-semibold text-neutral-900">{submission.contact_name} ({submission.contact_email})</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Application Reference:</span>
                  <span className="font-mono font-bold text-sky-700">{submission.apply_reference_code || submission.id}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Existing PO / Ref:</span>
                  <span className="font-mono text-neutral-800">{submission.existing_order_reference || "N/A"}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Product / Fabric Type:</span>
                  <span className="text-neutral-800 font-medium">{submission.product_type || "Not provided"} · {submission.fabric_type || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Submitted Units:</span>
                  <span className="font-bold text-emerald-700">{totalQty} pcs</span>
                </div>
              </div>

              {Object.keys(sizeMatrix).length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <span>No size matrix found in submission. Please enter sizes manually in Step 5 (Gate 1 Sizes).</span>
                </div>
              )}

              {submission.client_notes && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-neutral-700">
                  <span className="font-bold text-amber-900 block mb-0.5">Client Note:</span>
                  {submission.client_notes}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Customer Profile */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 2 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-sky-600" />
                Customer Profile Linkage
              </h4>
              <div className="p-4 border border-neutral-200 rounded-xl space-y-3 bg-neutral-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm">
                    {submission.company_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-neutral-900">{submission.company_name}</div>
                    <div className="text-neutral-500">{submission.contact_email} {submission.contact_phone ? `· ${submission.contact_phone}` : ""}</div>
                  </div>
                </div>
                <div className="text-neutral-600 bg-white p-3 rounded-lg border border-neutral-200 text-xs">
                  This submission will link directly to the account profile in Supabase for <span className="font-semibold">{submission.company_name}</span>.
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Blanket PO */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 3 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-600" />
                Blanket PO Configuration
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">PO Number *</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Enter the customer's real PO number"
                    className={`w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-neutral-900 focus:border-sky-500 focus:outline-none ${
                      !poNumber.trim() ? "border-rose-300 bg-rose-50/40" : "border-neutral-200"
                    }`}
                  />
                  <p className={`text-[10px] mt-1 ${!poNumber.trim() ? "text-rose-600 font-medium" : "text-neutral-500"}`}>
                    {poNumber.trim()
                      ? "Pre-populated from customer intake reference."
                      : "No PO reference on file — enter or confirm the real PO number before converting."}
                  </p>
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Total Contract Qty (Live Sum)</label>
                  <input
                    type="number"
                    readOnly
                    value={totalQty}
                    className="w-full px-3 py-1.5 border border-emerald-200 bg-emerald-50/50 rounded-lg font-bold text-emerald-800"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Dynamically computed from Gate 1 Size Matrix.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Work Order */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 4 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-sky-600" />
                Work Order Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Work Order # *</label>
                  <input
                    type="text"
                    value={woNumber}
                    onChange={(e) => setWoNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-mono font-bold text-neutral-900 focus:border-sky-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Sequentially generated from the highest existing WO number.</p>
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Style Name / Code *</label>
                  <input
                    type="text"
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    placeholder="Required — no submission style found"
                    className={`w-full px-3 py-1.5 border rounded-lg font-medium text-neutral-900 focus:border-sky-500 focus:outline-none ${
                      !styleName.trim() ? "border-rose-300 bg-rose-50/40" : "border-neutral-200"
                    }`}
                  />
                  {!styleName.trim() && <p className="text-[10px] text-rose-600 font-medium mt-1">Style name is required.</p>}
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Colorway *</label>
                  <input
                    type="text"
                    value={colorway}
                    onChange={(e) => setColorway(e.target.value)}
                    placeholder="Required — no submission colorway found"
                    className={`w-full px-3 py-1.5 border rounded-lg text-neutral-900 focus:border-sky-500 focus:outline-none ${
                      !colorway.trim() ? "border-rose-300 bg-rose-50/40" : "border-neutral-200"
                    }`}
                  />
                  {!colorway.trim() && <p className="text-[10px] text-rose-600 font-medium mt-1">Colorway is required.</p>}
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">
                    Wash Process Formula {washRequired ? "*" : ""}
                  </label>
                  <input
                    type="text"
                    value={washType}
                    onChange={(e) => { setWashType(e.target.value); setWashTypeIsDefault(false); }}
                    disabled={!washRequired}
                    placeholder={washRequired ? "Required — no submission wash type found" : ""}
                    className={`w-full px-3 py-1.5 border rounded-lg text-neutral-900 focus:border-sky-500 focus:outline-none ${
                      washRequired && !washType.trim()
                        ? "border-rose-300 bg-rose-50/40"
                        : washTypeIsDefault
                        ? "border-amber-300 bg-amber-50/40"
                        : !washRequired
                        ? "border-neutral-200 bg-neutral-100/70 text-neutral-500"
                        : "border-neutral-200"
                    }`}
                  />
                  {washRequired && !washType.trim() ? (
                    <p className="text-[10px] text-rose-600 font-medium mt-1">Wash type is required for this order.</p>
                  ) : washTypeIsDefault ? (
                    <p className="text-[10px] text-amber-700 font-bold mt-1">Default — the customer never explicitly chose a wash type; confirm this is correct before converting.</p>
                  ) : !washRequired ? (
                    <p className="text-[10px] text-neutral-500 mt-1">Washing is not in this order's selected services.</p>
                  ) : null}
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Factory Due Date *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-lg text-neutral-900 focus:border-sky-500 focus:outline-none ${
                      !dueDate.trim() ? "border-rose-300 bg-rose-50/40" : "border-neutral-200"
                    }`}
                  />
                  {!dueDate.trim() && <p className="text-[10px] text-rose-600 font-medium mt-1">Due date is required — pick a real date or use the suggestion below.</p>}
                  <button
                    type="button"
                    onClick={() => setDueDate(capacitySuggestion.suggestedDate.toISOString().slice(0, 10))}
                    className="mt-1.5 w-full text-left text-[10px] text-sky-700 font-semibold flex items-center gap-1 hover:text-sky-900"
                    title={`${activeBacklogUnits.toLocaleString()} pcs active backlog + ${totalQty.toLocaleString()} pcs this order ÷ ${capacityConfig.dailyCapacityUnits.toLocaleString()}/day capacity + ${capacityConfig.laundryBufferDays}d laundry buffer`}
                  >
                    <Gauge className="w-3 h-3" />
                    Suggested: {capacitySuggestion.suggestedDate.toLocaleDateString()} ({capacitySuggestion.totalDays}d) — click to apply
                  </button>
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      const next = e.target.value as "Normal" | "Rush";
                      setPriority(next);
                      const mult = getRushMultiplierForTier(rushTiers, complexityTier);
                      setRushMultiplier(next === "Rush" ? mult : undefined);
                    }}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-medium text-neutral-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Rush">Rush (Priority Line Slot)</option>
                  </select>
                  {priority === "Rush" && (
                    <div className="mt-2 space-y-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-amber-900">Complexity Tier:</span>
                        <select
                          value={complexityTier || ""}
                          onChange={(e) => {
                            const nextTier = (e.target.value || null) as ComplexityTier | null;
                            setComplexityTier(nextTier);
                            setRushMultiplier(getRushMultiplierForTier(rushTiers, nextTier));
                          }}
                          className="h-6 px-1.5 py-0.5 rounded border border-amber-300 bg-white font-semibold text-xs text-neutral-900 focus:outline-none"
                        >
                          <option value="" disabled>Select tier...</option>
                          {(["Simple", "Moderate", "Complex"] as ComplexityTier[]).map((t) => {
                            const mult = getRushMultiplierForTier(rushTiers, t);
                            return (
                              <option key={t} value={t}>
                                {t} {mult != null ? `(${mult.toFixed(2)}x)` : "(not configured)"}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <p className="text-[10px] text-amber-700 font-semibold">
                        {!complexityTier
                          ? "No complexity tier configured for this article yet — set one in Settings → Pricing & Rates → Rush Pricing."
                          : rushMultiplier != null
                          ? `${rushMultiplier.toFixed(2)}x rate multiplier applied.`
                          : "No rush multiplier configured for this tier — set one in Settings → Pricing & Rates → Rush Pricing."}
                      </p>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-neutral-700 mb-1">
                    Initial Production Stage (Intake Entry Point)
                  </label>
                  <select
                    value={startingStage}
                    onChange={(e) => {
                      const newStage = Number(e.target.value);
                      setStartingStage(newStage);
                      // Manual override: keep whichever already-resolved
                      // stages still make sense downstream of the new
                      // starting point, always ending at Dispatch (13).
                      setSelectedStages((prev) => {
                        const rest = prev.filter((s) => s > newStage);
                        const merged = Array.from(new Set([newStage, ...rest, 13])).sort((a, b) => a - b);
                        return merged;
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-sky-300 bg-sky-50/50 rounded-lg text-sky-950 font-medium focus:border-sky-500 focus:outline-none"
                  >
                    <option value={1}>Stage 1: PO Received (Full CMT Order)</option>
                    <option value={2}>Stage 2: Raw Fabric Received & Inspected</option>
                    <option value={3}>Stage 3: Cutting Started</option>
                    <option value={4}>Stage 4: Cut Bundles Passed</option>
                    <option value={5}>Stage 5: Sewing Input</option>
                    <option value={6}>Stage 6: Sewing Assembly (Sew Only Job)</option>
                    <option value={7}>Stage 7: Trim & Assembly Check</option>
                    <option value={8}>Stage 8: Wash House Entry</option>
                    <option value={9}>Stage 9: Garment Wash (Wash Only Job)</option>
                    <option value={10}>Stage 10: Wash QC Checked</option>
                    <option value={11}>Stage 11: Button / Rivet Finishing</option>
                    <option value={12}>Stage 12: Final Quality Inspection (Finish Only Job)</option>
                    <option value={13}>Stage 13: Dispatched & In Transit</option>
                  </select>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Allows routing pre-cut, wash-only, or sew-only customer orders straight into their target factory stage.
                  </p>
                </div>

                {/* REQ-14 Section 3E: Pipeline Preview based on selected_stages */}
                {pipelinePreviewLabels.length > 0 && (
                  <div className="col-span-2 p-3 bg-sky-50 border border-sky-200 rounded-xl">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-1.5">
                      Pipeline Preview
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-sky-900">
                      {pipelinePreviewLabels.map((label, idx) => (
                        <span key={label} className="flex items-center gap-1.5">
                          {idx > 0 && <span className="text-sky-400">&rarr;</span>}
                          <span className="px-2 py-0.5 rounded-md bg-white border border-sky-200">{label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Gate 1 Planned Size Breakdown */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 5 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-600" />
                  Gate 1: Planned Size Breakdown (Submitted by Client)
                </h4>
                <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full text-xs">
                  Total: {totalQty} Units
                </span>
              </div>
              <p className="text-neutral-500 text-[11px]">
                This matrix is populated directly from the customer's Order Intake submission and sets Gate 1 (Planned) in the 5-stage production quality pipeline.
              </p>

              {Object.keys(sizeMatrix).length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <span>No size matrix found in submission. Add size columns below and enter quantities manually before converting.</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                {Object.entries(sizeMatrix).map(([sz, qty]) => (
                  <div key={sz} className="p-2 bg-white rounded-lg border border-neutral-200 flex flex-col justify-between relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-600">Size {sz}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSize(sz)}
                        className="text-neutral-300 hover:text-rose-600 transition-colors p-0.5"
                        title="Remove size column"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => handleSizeChange(sz, e.target.value)}
                      className="w-full text-center font-bold text-neutral-900 border-b border-neutral-300 focus:border-sky-500 focus:outline-none mt-1 py-0.5 text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Add Custom Size Column */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="e.g. 28, 38, XL..."
                  value={newSizeKey}
                  onChange={(e) => setNewSizeKey(e.target.value)}
                  className="px-2.5 py-1 border border-neutral-200 rounded-lg text-xs w-32 uppercase"
                />
                <button
                  type="button"
                  onClick={handleAddSize}
                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-medium text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Size Column
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Documents & Cut Sheet Link */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 6 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-sky-600" />
                Documents & Cut Sheet Linkage
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkCutSheet}
                    onChange={(e) => setLinkCutSheet(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                  <div className="flex-1">
                    <span className="font-medium text-neutral-800 block">
                      Link Approved Factory Cut Sheet to Work Order
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Style: {styleName} · Wash: {washType}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkDocs}
                    onChange={(e) => setLinkDocs(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <FileCheck2 className="w-4 h-4 text-sky-600" />
                  <div className="flex-1">
                    <span className="font-medium text-neutral-800 block">
                      Copy {documents.length} Uploaded Client Documents into Work Order Vault
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Tech packs, measurement spec sheets, artwork files
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!conversionState.isConverting && !conversionState.result && (
          <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 space-y-2">
            {activeStep === 6 && hasRequiredFieldErrors && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-medium flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-rose-600" />
                <span>Before converting: {requiredFieldErrors.join(" ")}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={activeStep === 1}
                onClick={() => setActiveStep((s) => s - 1)}
                className="px-3.5 py-1.5 border border-neutral-300 rounded-lg text-neutral-700 font-medium hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              {activeStep < 6 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => s + 1)}
                  className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg font-semibold hover:bg-neutral-800 flex items-center gap-1 text-xs"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={hasRequiredFieldErrors}
                  onClick={handleExecuteConversion}
                  title={hasRequiredFieldErrors ? requiredFieldErrors.join(" ") : undefined}
                  className={`px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 text-xs shadow-md ${
                    hasRequiredFieldErrors
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm & Issue Production PO ({totalQty} pcs)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
