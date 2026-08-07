import { useState } from "react";
import { Send, FileSpreadsheet, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import type { UpdateRequest, UpdateRequestStatus } from "../../lib/types";

interface RequestResponseFormProps {
  request: UpdateRequest;
  onRespond: (payload: {
    requestId: string;
    status: UpdateRequestStatus;
    resolutionNotes?: string;
    newCutSheetId?: string;
  }) => Promise<any>;
}

export function RequestResponseForm({ request, onRespond }: RequestResponseFormProps) {
  const [status, setStatus] = useState<UpdateRequestStatus>(
    (request.status as UpdateRequestStatus) || "under_review"
  );
  const [resolutionNotes, setResolutionNotes] = useState(request.resolution_notes || "");
  const [newCutSheetId, setNewCutSheetId] = useState(request.new_cut_sheet_id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await onRespond({
        requestId: request.id,
        status,
        resolutionNotes: resolutionNotes.trim() || undefined,
        newCutSheetId: newCutSheetId.trim() || undefined,
      });
      setFeedback("Response saved and status notification dispatched to client.");
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded-xl border border-neutral-200 space-y-4 shadow-sm text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-neutral-900 flex items-center gap-1.5">
          <Send className="w-4 h-4 text-amber-600" />
          Merchandiser Response & Status Resolution
        </h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block font-semibold text-neutral-700 mb-1">Set Resolution Status *</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as UpdateRequestStatus)}
            className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg font-semibold text-neutral-900"
          >
            <option value="submitted">Submitted (Received)</option>
            <option value="under_review">Under Review (Pattern/Production)</option>
            <option value="in_progress">In Progress (Engineering Changes)</option>
            <option value="completed">Completed (Applied to Production)</option>
            <option value="rejected">Rejected (Cannot Accommodate)</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-neutral-700 mb-1">
            Client Resolution Message & Engineering Notes
          </label>
          <textarea
            rows={3}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Explain actions taken, pattern changes, or reasons for rejection. This text will be emailed directly to the client."
            className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        {status === "completed" && (
          <div>
            <label className="block font-semibold text-neutral-700 mb-1 flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              Link Revised Cut Sheet ID (Optional)
            </label>
            <input
              type="text"
              value={newCutSheetId}
              onChange={(e) => setNewCutSheetId(e.target.value)}
              placeholder="e.g. cs-submission-101-v2"
              className="w-full p-2 bg-neutral-50 border border-neutral-200 rounded-lg font-mono text-neutral-900"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
        <span className="text-[11px] text-neutral-400">
          Will dispatch status email template to <span className="font-semibold">{request.requested_by_email}</span>
        </span>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
        >
          {isSubmitting ? "Updating..." : "Save & Notify Client"} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {feedback && (
        <p className={`text-xs ${feedback.startsWith("Error") ? "text-rose-600" : "text-emerald-700 font-medium"}`}>
          {feedback}
        </p>
      )}
    </form>
  );
}
