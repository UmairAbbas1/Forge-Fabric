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
} from "lucide-react";
import type { ApplySubmission } from "../../lib/types";
import { useSubmissionDetail } from "../../hooks/merchandiser/useSubmissionDetail";
import { ConversionModal } from "./ConversionModal";

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
  } = useSubmissionDetail(initialSub.id);

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isRequestInfoOpen, setIsRequestInfoOpen] = useState(false);
  const [questions, setQuestions] = useState("");
  const [notes, setNotes] = useState(submission?.internal_notes || "");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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
    await rejectSubmission.mutateAsync({ reason: rejectReason.trim() });
    setIsRejectOpen(false);
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
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 rounded">
              {activeSub.status.replace(/_/g, " ")}
            </span>
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
        {activeSub.status !== "converted" ? (
          <button
            type="button"
            onClick={() => setIsConvertOpen(true)}
            className="w-full py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs"
          >
            Convert to Blanket PO & Work Order
          </button>
        ) : (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center font-bold text-emerald-800">
            Order Converted to Production
          </div>
        )}

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
            className="py-1.5 px-3 bg-white border border-rose-200 text-rose-700 font-medium rounded-lg hover:bg-rose-50 flex items-center justify-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Reject
          </button>
        </div>
      </div>

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
                className="px-4 py-1.5 bg-sky-500 text-white font-bold rounded-lg hover:bg-sky-600 flex items-center gap-1"
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
            <h4 className="font-bold text-sm text-rose-800 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              Reject Order Submission
            </h4>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (e.g. Fabric lot out of stock, capacity full)..."
              className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg focus:ring-2 focus:ring-rose-500/20"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsRejectOpen(false)}
                className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="px-4 py-1.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
