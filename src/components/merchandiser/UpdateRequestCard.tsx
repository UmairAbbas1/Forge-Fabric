import { Clock, Paperclip, AlertCircle, ArrowUpRight } from "lucide-react";
import type { UpdateRequest } from "../../lib/types";

interface UpdateRequestCardProps {
  request: UpdateRequest;
  onClick: () => void;
}

export function UpdateRequestCard({ request, onClick }: UpdateRequestCardProps) {
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-l-4 border-l-rose-500 bg-white";
      case "high":
        return "border-l-4 border-l-amber-500 bg-white";
      default:
        return "border-l-4 border-l-neutral-300 bg-white";
    }
  };

  const formatAge = (isoString: string) => {
    const diffHours = (Date.now() - new Date(isoString).getTime()) / (1000 * 3600);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 ${getPriorityStyle(
        request.priority
      )}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
          {request.request_type.replace(/_/g, " ")}
        </span>
        <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
          <Clock className="w-3 h-3" />
          {formatAge(request.created_at)}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-bold text-neutral-900 line-clamp-1 group-hover:text-amber-800 transition-colors">
          {request.request_subject}
        </h4>
        <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{request.request_description}</p>
      </div>

      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
        <span className="truncate max-w-[130px]">{request.requested_by_email}</span>

        <div className="flex items-center gap-1.5">
          {request.attachment_urls && request.attachment_urls.length > 0 && (
            <span className="flex items-center gap-0.5 text-neutral-500 font-medium">
              <Paperclip className="w-3 h-3" />
              {request.attachment_urls.length}
            </span>
          )}
          <ArrowUpRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-amber-600 transition-colors" />
        </div>
      </div>
    </div>
  );
}
