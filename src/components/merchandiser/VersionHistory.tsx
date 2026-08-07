import { X, History, Clock, User, CheckCircle, XCircle } from "lucide-react";
import type { CutSheetVersionRecord } from "../../lib/types";

interface VersionHistoryModalProps {
  versions: CutSheetVersionRecord[];
  onClose: () => void;
}

export function VersionHistoryModal({ versions, onClose }: VersionHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm text-neutral-900">Cut Sheet Revision Timeline</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline List */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {versions.map((ver, idx) => {
            const isLatest = idx === 0;
            return (
              <div key={ver.id} className="relative pl-6 pb-2 border-l-2 border-amber-300 last:border-transparent">
                <div className="absolute -left-1.5 top-0.5 w-3 h-3 rounded-full bg-amber-600 ring-4 ring-white" />
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-neutral-900">v{ver.version}</span>
                      {isLatest && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                          Current Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ver.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-neutral-700 font-medium">{ver.change_summary}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200 text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {ver.created_by}
                    </span>
                    <span className="font-mono font-semibold text-neutral-700">
                      Total: {ver.snapshot?.grand_total || 0} pcs
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
