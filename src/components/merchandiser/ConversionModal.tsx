import { useState, useEffect } from "react";
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
import { supabase, isRealSupabase } from "../../lib/supabase";
import { calculateSuggestedShipDate } from "../../lib/utils";
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
  const { orders } = useAppData();
  const [activeStep, setActiveStep] = useState<number>(1);
  const [selectedStyleBlockIndex, setSelectedStyleBlockIndex] = useState<number>(0);
  const [newSizeKey, setNewSizeKey] = useState("");

  // REQ-09: Capacity-Based Dynamic Delivery Date Scheduling
  const [capacityConfig, setCapacityConfig] = useState({ dailyCapacityUnits: 144_000, laundryBufferDays: 2 });
  useEffect(() => {
    if (!isRealSupabase) return;
    supabase
      .from("tenant_config")
      .select("daily_capacity_units, laundry_buffer_days")
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { daily_capacity_units?: number; laundry_buffer_days?: number } | null }) => {
        if (data) {
          setCapacityConfig({
            dailyCapacityUnits: data.daily_capacity_units || 144_000,
            laundryBufferDays: data.laundry_buffer_days ?? 2,
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
  const [dueDate, setDueDate] = useState("");
  const [orderType, setOrderType] = useState<"Bulk" | "Sample" | "Rush">("Bulk");
  const [priority, setPriority] = useState<"Normal" | "Rush">("Normal");
  const [startingStage, setStartingStage] = useState<number>(1);
  const [sizeMatrix, setSizeMatrix] = useState<SizeMatrix>({});
  const [linkDocs, setLinkDocs] = useState(true);
  const [linkCutSheet, setLinkCutSheet] = useState(true);

  // Dynamic initialization whenever submission or cutSheet changes or modal opens
  useEffect(() => {
    if (!submission || !isOpen) return;

    const styleBlocks =
      submission.style_blocks && Array.isArray(submission.style_blocks) && submission.style_blocks.length > 0
        ? submission.style_blocks
        : null;

    const targetBlock = (styleBlocks && styleBlocks[selectedStyleBlockIndex]) || styleBlocks?.[0];

    // Extract size matrix
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
    } else {
      extractedSizes = { "28": 0, "30": 0, "32": 0, "34": 0, "36": 0, "38": 0 };
    }

    setSizeMatrix(extractedSizes);

    // Style name / code
    const initialStyle =
      targetBlock?.style_number ||
      targetBlock?.style_name ||
      cutSheet?.style_no ||
      submission.product_type ||
      "STYLE-PROD";
    setStyleName(initialStyle);

    // Colorway
    const initialColor =
      targetBlock?.colorway ||
      (submission as any).colorway ||
      "Standard Colorway";
    setColorway(initialColor);

    // Wash type
    const initialWash =
      targetBlock?.wash_type ||
      cutSheet?.sheet_data?.wash_type ||
      cutSheet?.wash_dx_cd ||
      (submission as any).wash_type ||
      "Standard Finish";
    setWashType(initialWash);

    // PO Number
    const initialPo =
      submission.existing_order_reference ||
      (submission.apply_reference_code
        ? submission.apply_reference_code.replace("APP-", "PO-")
        : `PO-2026-${submission.id ? submission.id.slice(0, 4).toUpperCase() : Math.floor(1000 + Math.random() * 9000)}`);
    setPoNumber(initialPo);

    // WO Number
    const initialWo =
      submission.apply_reference_code
        ? submission.apply_reference_code.replace("APP-", "WO-")
        : `WO-2026-${submission.id ? submission.id.slice(0, 4).toUpperCase() : Math.floor(1000 + Math.random() * 9000)}`;
    setWoNumber(initialWo);

    // Due Date
    const initialDue =
      (submission as any).planned_ship_date ||
      (submission as any).due_date ||
      new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    setDueDate(initialDue);

    // Order Type & Priority
    setOrderType(submission.submission_type === "sample_request" ? "Sample" : "Bulk");
    setPriority((targetBlock as any)?.priority || (submission as any).priority || "Normal");

    // Starting Stage
    const stage =
      targetBlock?.starting_stage ||
      (submission as any).starting_stage ||
      ((submission as any).service_scope === "wash_only" || targetBlock?.service_scope === "wash_only"
        ? 9
        : (submission as any).service_scope === "sew_only" || targetBlock?.service_scope === "sew_only"
        ? 6
        : (submission as any).service_scope === "finish_only" || targetBlock?.service_scope === "finish_only"
        ? 12
        : 1);
    setStartingStage(stage);

    setActiveStep(1);
    resetState();
  }, [submission, cutSheet, isOpen, selectedStyleBlockIndex]);

  if (!isOpen) return null;

  const totalQty = Object.values(sizeMatrix).reduce((a, b) => a + (Number(b) || 0), 0);

  // REQ-09: active backlog = total units across all orders not yet dispatched (stage < 13)
  const activeBacklogUnits = orders.filter((o) => o.current_stage < 13 && o.status !== "Shipped").reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
  const capacitySuggestion = calculateSuggestedShipDate(totalQty, activeBacklogUnits, capacityConfig.dailyCapacityUnits, capacityConfig.laundryBufferDays);

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
        size_breakdown: sizeMatrix,
        gate_1_planned_sizes: sizeMatrix,
        link_documents: linkDocs,
        link_cut_sheet: linkCutSheet,
        starting_stage: startingStage,
        service_scope: (submission as any).service_scope,
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
                  <span className="text-neutral-800 font-medium">{submission.product_type || "Denim/Bottoms"} · {submission.fabric_type || "Woven"}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Submitted Units:</span>
                  <span className="font-bold text-emerald-700">{totalQty} pcs</span>
                </div>
              </div>

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
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-mono font-bold text-neutral-900 focus:border-sky-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">Pre-populated from customer intake reference.</p>
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
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Style Name / Code *</label>
                  <input
                    type="text"
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-medium text-neutral-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Colorway</label>
                  <input
                    type="text"
                    value={colorway}
                    onChange={(e) => setColorway(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Wash Process Formula</label>
                  <input
                    type="text"
                    value={washType}
                    onChange={(e) => setWashType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Factory Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-900 focus:border-sky-500 focus:outline-none"
                  />
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
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-medium text-neutral-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Rush">Rush (Priority Line Slot)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-neutral-700 mb-1">
                    Initial Production Stage (Intake Entry Point)
                  </label>
                  <select
                    value={startingStage}
                    onChange={(e) => setStartingStage(Number(e.target.value))}
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
          <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
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
                onClick={handleExecuteConversion}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-1.5 text-xs shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Issue Production PO ({totalQty} pcs)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
