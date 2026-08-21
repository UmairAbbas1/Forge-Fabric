import { Clock, ExternalLink, ArrowRight, UserPlus, Sparkles, Building } from "lucide-react";
import type { ApplySubmission } from "../../lib/types";
import { STATUS_TONE_CLASSES, getSubmissionStatusTone, getSubmissionStatusLabel } from "../../lib/statusColors";

interface SubmissionTableProps {
  submissions: ApplySubmission[];
  selectedSubmissionId: string | null;
  onSelectSubmission: (submission: ApplySubmission) => void;
  onQuickConvert: (submission: ApplySubmission) => void;
}

export function SubmissionTable({
  submissions,
  selectedSubmissionId,
  onSelectSubmission,
  onQuickConvert,
}: SubmissionTableProps) {
  const getAgingBadge = (submittedAt: string, status: string) => {
    if (status === "converted" || status === "rejected") return null;
    const diffHours = (Date.now() - new Date(submittedAt).getTime()) / (1000 * 3600);

    if (diffHours >= 48) {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border animate-pulse ${STATUS_TONE_CLASSES.destructive}`}>
          &gt;48h Critical
        </span>
      );
    }
    if (diffHours >= 24) {
      return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_TONE_CLASSES.warning}`}>
          &gt;24h Aging
        </span>
      );
    }
    return (
      <span className="text-[10px] text-neutral-400 font-medium">
        {Math.floor(diffHours)}h ago
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const tone = getSubmissionStatusTone(status);
    return (
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${STATUS_TONE_CLASSES[tone]}`}>
        {getSubmissionStatusLabel(status)}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-semibold uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Ref / Client</th>
              <th className="p-3.5">Contact</th>
              <th className="p-3.5">Source & Type</th>
              <th className="p-3.5">Aging</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-neutral-400">
                  No matching submissions found.
                </td>
              </tr>
            ) : (
              submissions.map((sub) => {
                const isSelected = selectedSubmissionId === sub.id;
                const diffHours = (Date.now() - new Date(sub.submitted_at).getTime()) / (1000 * 3600);
                const isAgingCritical = (sub.status === "pending_review" || sub.status === "under_review") && diffHours >= 48;

                return (
                  <tr
                    key={sub.id}
                    onClick={() => onSelectSubmission(sub)}
                    className={`cursor-pointer transition-all hover:bg-neutral-50 ${
                      isSelected ? "bg-sky-50/60 font-medium" : ""
                    } ${isAgingCritical ? "border-l-4 border-l-rose-500" : ""}`}
                  >
                    {/* Ref & Company */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {sub.company_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                            {sub.company_name}
                            {sub.brand_name && (
                              <span className="text-[10px] font-normal text-neutral-500">
                                ({sub.brand_name})
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-amber-800">
                            {sub.apply_reference_code || sub.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="p-3.5">
                      <div className="text-neutral-900 font-medium">{sub.contact_name}</div>
                      <div className="text-[11px] text-neutral-500">{sub.contact_email}</div>
                    </td>

                    {/* Source & Type */}
                    <td className="p-3.5">
                      <span className="capitalize font-medium text-neutral-700 block">
                        {sub.submission_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-neutral-400 capitalize">
                        {sub.source.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Aging */}
                    <td className="p-3.5">{getAgingBadge(sub.submitted_at, sub.status)}</td>

                    {/* Status */}
                    <td className="p-3.5">{getStatusBadge(sub.status)}</td>

                    {/* Actions */}
                    <td className="p-3.5 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      {sub.status !== "converted" && sub.status !== "rejected" && (
                        <button
                          type="button"
                          onClick={() => onQuickConvert(sub)}
                          className="px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 shadow-xs inline-flex items-center gap-1 text-[11px]"
                        >
                          Convert
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectSubmission(sub)}
                        className="px-2.5 py-1 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 inline-flex items-center gap-1 text-[11px]"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
