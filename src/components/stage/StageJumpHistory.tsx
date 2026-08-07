import React from "react";
import {
  History,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShieldAlert,
  GitCommit,
} from "lucide-react";
import type { StageJumpLog } from "../../lib/types";
import { STAGES } from "../../lib/mockData";

interface StageJumpHistoryProps {
  logs: StageJumpLog[];
  isLoading?: boolean;
}

export const StageJumpHistory: React.FC<StageJumpHistoryProps> = ({
  logs = [],
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-neutral-200 text-center text-xs text-neutral-400">
        Loading stage jump audit trail...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/90 text-center space-y-2 shadow-xs">
        <div className="h-9 w-9 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto">
          <History className="w-4 h-4" />
        </div>
        <p className="text-xs font-semibold text-neutral-700">No Stage Jump Logs Recorded</p>
        <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
          All direct stage advancements and backward rollbacks will appear in this immutable audit history.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm overflow-hidden">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-neutral-100 rounded-xl text-neutral-700">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
              Stage Audit & Transition History
            </h4>
            <p className="text-[11px] text-neutral-500">
              {logs.length} logged stage transition{logs.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="divide-y divide-neutral-100 max-h-80 overflow-y-auto">
        {logs.map((log) => {
          const fromStageDef = STAGES.find((s) => s.id === log.from_stage_id);
          const toStageDef = STAGES.find((s) => s.id === log.to_stage_id);
          const isBackward = log.to_stage_id < log.from_stage_id;
          const isSkip = log.to_stage_id > log.from_stage_id + 1;

          return (
            <div key={log.id} className="p-4 hover:bg-neutral-50/60 transition-colors text-xs space-y-2">
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                
                {/* From -> To Badges */}
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                    Stage {log.from_stage_id}
                  </span>
                  
                  {isBackward ? (
                    <span className="text-rose-600 flex items-center gap-1 font-bold text-[11px] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      <RotateCcw className="w-3 h-3" /> Rollback
                    </span>
                  ) : isSkip ? (
                    <span className="text-purple-600 flex items-center gap-1 font-bold text-[11px] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                      <ArrowRight className="w-3 h-3" /> Multi-Skip
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1 font-bold text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <ArrowRight className="w-3 h-3" /> Advanced
                    </span>
                  )}

                  <span className="font-mono font-bold text-neutral-900 bg-amber-100/80 px-2 py-0.5 rounded">
                    Stage {log.to_stage_id}
                  </span>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(log.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Stage Names */}
              <div className="text-neutral-600 text-[11px]">
                <span className="font-medium text-neutral-800">{fromStageDef?.name || `Stage ${log.from_stage_id}`}</span>
                <span className="mx-1 text-neutral-400">→</span>
                <span className="font-semibold text-neutral-900">{toStageDef?.name || `Stage ${log.to_stage_id}`}</span>
              </div>

              {/* Reason / Notes */}
              {log.jump_reason && (
                <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100 text-[11px] text-neutral-700">
                  <span className="font-bold text-neutral-800 mr-1">Justification:</span>
                  {log.jump_reason}
                </div>
              )}

              {/* User Metadata */}
              <div className="flex items-center gap-3 text-[10px] text-neutral-400 pt-0.5">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-neutral-400" />
                  <span>Authorized by: <strong className="text-neutral-600">{log.jumped_by_name || log.jumped_by_role || "Administrator"}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
