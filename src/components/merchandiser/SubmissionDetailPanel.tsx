import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  X,
  Building,
  Mail,
  Phone,
  FileSpreadsheet,
  FileText,
  Sparkles,
  HelpCircle,
  XCircle,
  UserCheck,
  Download,
  Clock,
  Send,
  Calculator,
  BadgeDollarSign,
  Layers,
  Zap,
} from "lucide-react";
import type { ApplySubmission } from "../../lib/types";
import { useSubmissionDetail } from "../../hooks/merchandiser/useSubmissionDetail";
import { ConversionModal } from "./ConversionModal";
import { PricingQuoteModal } from "./PricingQuoteModal";
import { buildPipelinePreviewLabels } from "../../lib/service-scope-constants";
import { STATUS_TONE_CLASSES, getSubmissionStatusTone, getSubmissionStatusLabel } from "../../lib/statusColors";

// REQ-14 Section 3E: per-service detail field descriptors, mirroring the
// collection fields in ServiceScopeSelector/StyleBlockEditor (Section 3C).
// Shown per style block so the merchandiser sees exactly what the customer
// provided — no hardcoded defaults, missing fields render as "Not provided."
const SERVICE_DETAIL_SECTIONS: Array<{ key: string; title: string; fields: Array<{ key: string; label: string }> }> = [
  {
    key: "receiving_details",
    title: "Fabric Receiving",
    fields: [
      { key: "fabric_roll_count", label: "Fabric Rolls Expected" },
      { key: "supplier_name", label: "Supplier Name" },
      { key: "expected_delivery_date", label: "Expected Delivery Date" },
      { key: "inspection_level", label: "Inspection Level" },
    ],
  },
  {
    key: "cutting_details",
    title: "Cutting & Bundling",
    fields: [
      { key: "fabric_weight", label: "Fabric Weight" },
      { key: "estimated_yardage", label: "Estimated Yardage" },
      { key: "marker_notes", label: "Marker Notes" },
      { key: "special_instructions", label: "Special Instructions" },
    ],
  },
  {
    key: "sewing_details",
    title: "Sewing Assembly",
    fields: [
      { key: "thread_color_specs", label: "Thread Color Specs" },
      { key: "stitch_type", label: "Stitch Type" },
      { key: "label_placement_notes", label: "Label Placement Notes" },
    ],
  },
  {
    key: "wash_details",
    title: "Washing & Laundry",
    fields: [
      { key: "wash_recipe", label: "Wash Recipe" },
      { key: "target_shade", label: "Target Shade" },
      { key: "shrinkage_tolerance", label: "Shrinkage Tolerance" },
      { key: "hand_feel_target", label: "Hand-Feel Target" },
    ],
  },
  {
    key: "finishing_details",
    title: "Finishing & Effects",
    fields: [
      { key: "laser_pattern_ref", label: "Laser Pattern Ref" },
      { key: "ozone_level", label: "Ozone Level" },
      { key: "crease_pattern_3d", label: "3D Crease Pattern" },
      { key: "spray_details", label: "Spray Details" },
      { key: "distressing_level", label: "Distressing Level" },
    ],
  },
  {
    key: "packing_details",
    title: "Pressing, Tagging & Packing",
    fields: [
      { key: "hangtag_specs", label: "Hangtag Specs" },
      { key: "care_label_text", label: "Care Label Text" },
      { key: "folding_method", label: "Folding Method" },
      { key: "poly_bag_required", label: "Poly Bag Required" },
      { key: "carton_specs", label: "Carton Specs" },
    ],
  },
];

function formatDetailValue(v: any): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

interface SubmissionDetailPanelProps {
  submission: ApplySubmission;
  onClose: () => void;
}

export function SubmissionDetailPanel({ submission: initialSub, onClose }: SubmissionDetailPanelProps) {
  const {
    submission,
    cutSheet,
    documents,
    assignMerchandiser,
    requestMoreInfo,
    rejectSubmission,
    updateInternalNotes,
    refetch,
  } = useSubmissionDetail(initialSub.id);

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [isRequestInfoOpen, setIsRequestInfoOpen] = useState(false);
  const [questions, setQuestions] = useState("");
  const [notes, setNotes] = useState(submission?.internal_notes || "");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  const activeSub = submission || initialSub;

  const handleRequestInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questions.trim()) return;
    const qList = questions.split("\n").filter((q) => q.trim().length > 0);
    await requestMoreInfo.mutateAsync({ questions: qList });
    setIsRequestInfoOpen(false);
    setQuestions("");
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setRejectError("");
    try {
      await rejectSubmission.mutateAsync({ reason: rejectReason.trim() });
      setIsRejectOpen(false);
      setRejectReason("");
    } catch (err: any) {
      setRejectError(err?.message || "Failed to reject submission. Please try again.");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden flex flex-col h-full text-xs">
      {/* Panel Header */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-800 text-xs">
              {activeSub.apply_reference_code || activeSub.id}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${STATUS_TONE_CLASSES[getSubmissionStatusTone(activeSub.status)]}`}>
              {getSubmissionStatusLabel(activeSub.status)}
            </span>
            {(activeSub as any).priority === "Rush" && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-black uppercase flex items-center gap-1">
                <Zap className="w-3 h-3" /> Rush
                {(activeSub as any).rush_multiplier ? ` · ${(activeSub as any).rush_multiplier}x` : ""}
              </span>
            )}
          </div>
          <h3 className="font-bold text-neutral-900 text-sm mt-0.5">{activeSub.company_name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Details */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        {/* Contact Info */}
        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-800">{activeSub.contact_name}</span>
            <span className="text-[11px] text-neutral-400 capitalize">{activeSub.source}</span>
          </div>
          <div className="flex items-center gap-1.5 text-neutral-600">
            <Mail className="w-3.5 h-3.5 text-neutral-400" />
            <span>{activeSub.contact_email}</span>
          </div>
          {activeSub.contact_phone && (
            <div className="flex items-center gap-1.5 text-neutral-600">
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span>{activeSub.contact_phone}</span>
            </div>
          )}
        </div>

        {/* Client Notes */}
        {activeSub.client_notes && (
          <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl text-neutral-700">
            <span className="font-bold text-amber-900 block mb-0.5">Client Note:</span>
            <p className="leading-relaxed">{activeSub.client_notes}</p>
          </div>
        )}

        {/* REQ-14: Requested Services badge strip (Section 3E) */}
        {(() => {
          const requestedStages = (activeSub as any).requested_stages as number[] | undefined;
          if (!requestedStages || requestedStages.length === 0) return null;
          const labels = buildPipelinePreviewLabels(requestedStages);
          return (
            <div>
              <h4 className="font-bold text-neutral-900 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                Requested Services
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* REQ-14 Section 3E: per-style-block, per-service detail sections.
            No hardcoded defaults — a field the customer left empty renders
            as "Not provided," not a guessed value. */}
        {((activeSub as any).style_blocks as any[] | undefined)?.map((block, blockIdx) => {
          const sections = SERVICE_DETAIL_SECTIONS.filter((s) => block?.[s.key] && typeof block[s.key] === "object");
          if (sections.length === 0) return null;
          return (
            <div key={block?.id || blockIdx} className="space-y-2">
              {((activeSub as any).style_blocks as any[]).length > 1 && (
                <h4 className="font-bold text-neutral-900">
                  Style {blockIdx + 1}: {block.style_name || block.style_number || `Block #${blockIdx + 1}`} — Service Details
                </h4>
              )}
              {sections.map((section) => (
                <div key={section.key} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="font-bold text-neutral-800 block mb-1.5">{section.title}</span>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {section.fields.map((f) => {
                      const raw = block[section.key]?.[f.key];
                      const formatted = formatDetailValue(raw);
                      return (
                        <div key={f.key}>
                          <span className="text-neutral-500 block text-[10px] uppercase tracking-wide">{f.label}</span>
                          {formatted ? (
                            <span className="text-neutral-800 font-medium">{formatted}</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Not provided — merchandiser to specify</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Cut Sheet Quick Card */}
        {cutSheet ? (
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-neutral-900">{cutSheet.style_no}</span>
              </div>
              <span className="font-mono font-bold text-amber-800">
                {cutSheet.sheet_data?.grand_total || 0} pcs
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">{cutSheet.style_description}</p>
            <div className="pt-1 flex justify-end">
              <Link
                to="/submissions/$submissionId/cut-sheet"
                params={{ submissionId: activeSub.id }}
                className="px-3 py-1 bg-white border border-neutral-300 rounded-lg font-semibold hover:bg-neutral-100 text-neutral-800 inline-flex items-center gap-1"
              >
                Open Full Cut Sheet Editor &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-400 text-center">
            No cut sheet attached
          </div>
        )}

        {/* Uploaded Documents */}
        <div>
          <h4 className="font-bold text-neutral-900 mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-600" />
            Uploaded Documents ({documents.length})
          </h4>
          <div className="space-y-1.5">
            {documents.length === 0 ? (
              <p className="text-neutral-400 text-center py-2">No documents attached.</p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-neutral-800 block">{doc.file_name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">{doc.doc_type}</span>
                  </div>
                  <button
                    type="button"
                    className="p-1 text-neutral-500 hover:text-amber-700"
                    title="Download document"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Merchandiser Internal Notes */}
        <div>
          <h4 className="font-bold text-neutral-900 mb-1">Merchandiser Internal Notes</h4>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateInternalNotes.mutate(notes)}
            placeholder="Add internal sizing, fabric sourcing, or margin notes..."
            className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-200 space-y-2">
        {/* REQ-07: Pricing Approval Workflow — unquoted new orders should be
            priced before conversion. Repeat orders that reference an existing
            quote skip this (pricing_status stays 'Not_Required'). */}
        {(activeSub as any).submission_type !== "sample_request" && activeSub.status !== "converted" && (
          <div className="flex items-center justify-between p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
              <BadgeDollarSign className="w-3.5 h-3.5" />
              {(activeSub as any).pricing_status === "Pending_Pricing_Approval"
                ? "Quote sent — awaiting customer acceptance"
                : "Pricing"}
            </span>
            <button
              type="button"
              onClick={() => setIsQuoteOpen(true)}
              className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold text-[11px] flex items-center gap-1"
            >
              <Calculator className="w-3 h-3" /> {(activeSub as any).pricing_status === "Pending_Pricing_Approval" ? "Revise Quote" : "Issue Price Quote"}
            </button>
          </div>
        )}

        {activeSub.status === "converted" ? (
          <div className="p-2.5 bg-success/10 border border-success/20 rounded-xl text-center font-bold text-success flex items-center justify-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span>Order Approved &amp; Converted to Production</span>
          </div>
        ) : activeSub.status === "rejected" ? (
          <div className="p-2.5 bg-muted border border-border rounded-xl text-center space-y-1">
            <div className="font-bold text-muted-foreground flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" />
              <span>Application Rejected</span>
            </div>
            {activeSub.rejection_reason && (
              <p className="text-[11px] text-muted-foreground">{activeSub.rejection_reason}</p>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsConvertOpen(true)}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Approve PO &amp; Convert to Work Orders
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsRequestInfoOpen(true)}
                className="py-1.5 px-3 bg-white border border-neutral-200 text-neutral-700 font-medium rounded-lg hover:bg-neutral-100 flex items-center justify-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" /> Request Info
              </button>

              <button
                type="button"
                onClick={() => setIsRejectOpen(true)}
                className="py-1.5 px-3 bg-white border border-destructive/30 text-destructive font-medium rounded-lg hover:bg-destructive/10 flex items-center justify-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </>
        )}
      </div>

      {/* Pricing Quote Modal */}
      {isQuoteOpen && (
        <PricingQuoteModal
          submission={activeSub}
          isOpen={isQuoteOpen}
          onClose={() => setIsQuoteOpen(false)}
          onIssued={() => refetch()}
        />
      )}

      {/* Conversion Modal */}
      {isConvertOpen && (
        <ConversionModal
          submission={activeSub}
          cutSheet={cutSheet}
          documents={documents}
          isOpen={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
        />
      )}

      {/* Request Info Modal */}
      {isRequestInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-4 max-w-md w-full space-y-3">
            <h4 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              Request Clarification from Client
            </h4>
            <p className="text-xs text-neutral-500">
              Enter questions (one per line). These will be emailed to <span className="font-semibold">{activeSub.contact_email}</span> and the status updated to "Needs Info".
            </p>
            <textarea
              rows={4}
              required
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="1. Please clarify desired selvedge id color (Red Line vs Plain).&#10;2. Confirm packaging carton breakdown."
              className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500/20"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsRequestInfoOpen(false)}
                className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestInfoSubmit}
                className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reject Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-4 max-w-md w-full space-y-3">
            <h4 className="font-bold text-sm text-destructive flex items-center gap-1.5">
              <XCircle className="w-4 h-4" />
              Reject Order Submission
            </h4>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (e.g. Fabric lot out of stock, capacity full)..."
              className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg focus:ring-2 focus:ring-destructive/20"
            />
            {rejectError && (
              <p className={`text-xs font-bold rounded-lg p-2 border ${STATUS_TONE_CLASSES.destructive}`}>
                {rejectError}
              </p>
            )}
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsRejectOpen(false);
                  setRejectError("");
                }}
                className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectSubmission.isPending}
                onClick={handleRejectSubmit}
                className="px-4 py-1.5 bg-destructive text-destructive-foreground font-bold rounded-lg hover:bg-destructive/90 disabled:bg-neutral-300"
              >
                {rejectSubmission.isPending ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
