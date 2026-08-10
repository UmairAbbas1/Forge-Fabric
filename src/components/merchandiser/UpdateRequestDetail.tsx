import { X, Clock, Mail, Paperclip, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import type { UpdateRequest, UpdateRequestStatus } from "../../lib/types";
import { RequestResponseForm } from "./RequestResponseForm";

interface UpdateRequestDetailProps {
  request: UpdateRequest;
  onClose: () => void;
  onRespond: (payload: {
    requestId: string;
    status: UpdateRequestStatus;
    resolutionNotes?: string;
    newCutSheetId?: string;
  }) => Promise<any>;
}

export function UpdateRequestDetail({ request, onClose, onRespond }: UpdateRequestDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                {request.request_type.replace(/_/g, " ")}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                  request.priority === "urgent"
                    ? "bg-rose-100 text-rose-800"
                    : request.priority === "high"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {request.priority} Priority
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mt-1">{request.request_subject}</h3>
          </div>

          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
            <div>
              <span className="text-neutral-400 block text-[11px]">Requested By:</span>
              <span className="font-semibold text-neutral-900 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                {request.requested_by_email}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Work Order Link:</span>
              <span className="font-mono font-bold text-neutral-800">
                {request.work_order_id || "Unlinked"}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Submitted:</span>
              <span className="text-neutral-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                {new Date(request.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Description Block */}
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
            <h4 className="font-bold text-neutral-900">Request Details & Instructions:</h4>
            <p className="text-neutral-800 leading-relaxed">{request.request_description}</p>
          </div>

          {/* Attachments if any */}
          {request.attachment_urls && request.attachment_urls.length > 0 && (
            <div>
              <h4 className="font-bold text-neutral-900 mb-2 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                Client Attachments ({request.attachment_urls.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {request.attachment_urls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-neutral-50 border border-neutral-200 rounded-lg hover:border-sky-400 flex items-center gap-1.5 text-neutral-700 hover:text-sky-700 font-medium transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attachment #{idx + 1}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Response Form Component */}
          <RequestResponseForm request={request} onRespond={onRespond} />
        </div>
      </div>
    </div>
  );
}
