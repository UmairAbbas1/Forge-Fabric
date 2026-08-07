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
} from "lucide-react";
import type { ApplySubmission, ApplyCutSheet, ApplyDocument, SizeMatrix } from "../../lib/types";
import { useConvertSubmission } from "../../hooks/merchandiser/useConvertSubmission";

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
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form State Pre-populated from submission
  const [poNumber, setPoNumber] = useState(`PO-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [woNumber, setWoNumber] = useState(`WO-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [styleName, setStyleName] = useState(cutSheet?.style_no || "DENIM-501-RAW");
  const [colorway, setColorway] = useState("Dark Indigo 3x1 RHT");
  const [washType, setWashType] = useState(cutSheet?.sheet_data?.wash_type || "Dark Stone Bleach Rinse");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [orderType, setOrderType] = useState<"Bulk" | "Sample" | "Rush">(
    submission.submission_type === "sample_request" ? "Sample" : "Bulk"
  );
  const [priority, setPriority] = useState<"Normal" | "Rush">("Normal");

  const [startingStage, setStartingStage] = useState<number>(
    (submission as any).starting_stage ||
    ((submission as any).service_scope === "wash_only" ? 9 :
     (submission as any).service_scope === "sew_only" ? 6 :
     (submission as any).service_scope === "finish_only" ? 12 : 1)
  );

  // Planned Gate 1 Sizes breakdown (Fix #8)
  const defaultSizes: SizeMatrix =
    cutSheet?.sheet_data?.components?.[0]?.size_matrix || {
      "29": 25,
      "30": 45,
      "31": 55,
      "32": 110,
      "33": 65,
      "34": 75,
      "36": 45,
      "38": 25,
      "40": 12,
    };
  const [sizeMatrix, setSizeMatrix] = useState<SizeMatrix>(defaultSizes);
  const totalQty = Object.values(sizeMatrix).reduce((a, b) => a + (Number(b) || 0), 0);

  const [linkDocs, setLinkDocs] = useState(true);
  const [linkCutSheet, setLinkCutSheet] = useState(true);

  useEffect(() => {
    if (cutSheet?.sheet_data?.components?.[0]?.size_matrix) {
      setSizeMatrix(cutSheet.sheet_data.components[0].size_matrix);
    }
  }, [cutSheet]);

  if (!isOpen) return null;

  const handleSizeChange = (sz: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setSizeMatrix((prev) => ({ ...prev, [sz]: num }));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Convert Application to Production Order
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Ref: <span className="font-mono text-neutral-700">{submission.apply_reference_code || submission.id}</span> · {submission.company_name}
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
        <div className="px-6 py-2.5 bg-neutral-100/70 border-b border-neutral-200 flex items-center justify-between text-xs overflow-x-auto">
          {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = activeStep > stepNum;
            const isCurrent = activeStep === stepNum;
            return (
              <button
                key={label}
                type="button"
                onClick={() => !conversionState.isConverting && setActiveStep(stepNum)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                  isCurrent
                    ? "bg-amber-600 text-white font-semibold shadow-xs"
                    : isCompleted
                    ? "text-emerald-700 hover:bg-neutral-200/80 font-medium"
                    : "text-neutral-500 hover:bg-neutral-200/50"
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
              <div className="w-12 h-12 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-900">
                  Executing Transactional Conversion ({conversionState.step}/{conversionState.totalSteps})
                </p>
                <p className="text-neutral-500">{conversionState.currentStepLabel}</p>
              </div>
            </div>
          )}

          {/* Error & Rollback Notification (Fix #1 & #5) */}
          {!conversionState.isConverting && conversionState.error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Conversion Rollback Executed
              </div>
              <p className="text-rose-700 text-xs">{conversionState.error}</p>
              <div className="pt-2 flex gap-2">
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
                  Blanket PO <span className="font-mono font-bold text-neutral-800">{conversionState.result.po_number}</span> and Work Order <span className="font-mono font-bold text-neutral-800">{conversionState.result.wo_number}</span> have been initialized in production.
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

          {/* Step 1: Review & Map */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 1 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900">Review Intake Submission Data</h4>
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-neutral-500 block">Company:</span>
                  <span className="font-semibold text-neutral-900">{submission.company_name}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Contact:</span>
                  <span className="font-semibold text-neutral-900">{submission.contact_name} ({submission.contact_email})</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Submission Source:</span>
                  <span className="capitalize text-neutral-800">{submission.source.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Type:</span>
                  <span className="capitalize text-neutral-800">{submission.submission_type.replace('_', ' ')}</span>
                </div>
              </div>
              {submission.client_notes && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-neutral-700">
                  <span className="font-bold text-amber-900 block mb-0.5">Client Note:</span>
                  {submission.client_notes}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Customer Profile */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 2 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900">Customer Profile Linkage</h4>
              <div className="p-4 border border-neutral-200 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="font-bold text-neutral-900">{submission.company_name}</div>
                    <div className="text-neutral-500">{submission.contact_email}</div>
                  </div>
                </div>
                <p className="text-neutral-600">
                  A customer account record will be linked or created in public.profiles. If new, onboarding magic credentials will be dispatched to <span className="font-semibold">{submission.contact_email}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Blanket PO */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 3 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900">Blanket PO Configuration</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">PO Number *</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Total Contract Qty</label>
                  <input
                    type="number"
                    readOnly
                    value={totalQty}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 font-bold text-amber-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Work Order */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 4 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900">Work Order Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Work Order # *</label>
                  <input
                    type="text"
                    value={woNumber}
                    onChange={(e) => setWoNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Style Name / Code *</label>
                  <input
                    type="text"
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Colorway</label>
                  <input
                    type="text"
                    value={colorway}
                    onChange={(e) => setColorway(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Wash Process Formula</label>
                  <input
                    type="text"
                    value={washType}
                    onChange={(e) => setWashType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Factory Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg"
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
                    className="w-full px-3 py-1.5 border border-amber-300 bg-amber-50/50 rounded-lg text-amber-950 font-medium"
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
                  <p className="text-[10px] text-amber-800 mt-1">
                    Allows fast-tracking pre-cut, wash-only, or sew-only customer orders straight into their target factory stage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Size Gate Records (Fix #8) */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 5 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Gate 1: Planned Size Breakdown
                </h4>
                <span className="font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full">
                  Total: {totalQty} Units
                </span>
              </div>
              <p className="text-neutral-500 text-[11px]">
                This matrix establishes Gate 1 (Planned) in the 5-stage production quality pipeline.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                {Object.entries(sizeMatrix).map(([sz, qty]) => (
                  <div key={sz} className="text-center p-2 bg-white rounded-lg border border-neutral-200">
                    <span className="text-[11px] font-bold text-neutral-500 block">Size {sz}</span>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => handleSizeChange(sz, e.target.value)}
                      className="w-full text-center font-bold text-neutral-900 border-b border-neutral-300 focus:border-amber-500 focus:outline-none mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Documents & Cut Sheet Link (Fix #8) */}
          {!conversionState.isConverting && !conversionState.result && activeStep === 6 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-neutral-900">Documents & Cut Sheet Linkage</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkCutSheet}
                    onChange={(e) => setLinkCutSheet(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-neutral-800">
                    Link Approved Factory Cut Sheet to Work Order (Style: {styleName})
                  </span>
                </label>

                <label className="flex items-center gap-2 p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkDocs}
                    onChange={(e) => setLinkDocs(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <FileCheck2 className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-neutral-800">
                    Copy {documents.length} Uploaded Client Documents into Work Order Vault
                  </span>
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
                <CheckCircle2 className="w-4 h-4" /> Confirm & Issue Production PO
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
