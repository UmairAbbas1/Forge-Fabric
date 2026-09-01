import React, { useState } from "react";
import {
  GitFork,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ChevronDown,
  Layers,
  Sparkles,
  ClipboardList,
  PackageOpen,
  SearchCheck,
  ClipboardCheck,
  Scissors,
  Boxes,
  Cog,
  Shield,
  Droplets,
  BadgeCheck,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { STAGES } from "../../lib/mockData";
import type { RoleType, StageJumpLog } from "../../lib/types";
import { hasPermission } from "../../lib/permissions";
import { getNextSelectedStage } from "../../lib/utils";

interface StageNavigatorProps {
  currentStage: number;
  orderId: string;
  userRole?: RoleType;
  userName?: string;
  onJumpStage: (toStage: number, reason?: string) => Promise<void> | void;
  isLoading?: boolean;
  /** REQ-14: this order's selective pipeline — the Quick Advance button and
      "Jump to CMT Stage" dropdown must target/flag stages actually in this
      order's own pipeline, not assume every order passes through all 13.
      Undefined/omitted means the legacy full 13-stage pipeline. */
  selectedStages?: number[];
}

const STAGE_ICONS: Record<number, React.FC<{ className?: string }>> = {
  1: ClipboardList,
  2: PackageOpen,
  3: SearchCheck,
  4: ClipboardCheck,
  5: Scissors,
  6: Boxes,
  7: Cog,
  8: Shield,
  9: Droplets,
  10: Sparkles,
  11: BadgeCheck,
  12: Tag,
  13: Truck,
};

const REASONS = [
  "Customer supplied pre-stitched goods (Wash & Laundry Only)",
  "Customer supplied cut panels (Sewing & Assembly Only)",
  "Customer sample fast-track pass",
  "Pre-washed / Pre-treated fabric lot",
  "Rework required (Quality Failure)",
  "Spec / Tech Pack amendment requested by Client",
  "Fabric lot or shade variation detected",
  "Marker re-nesting / Fabric shortage",
  "Wash color standard adjustment",
  "Supervisor / Merchandiser direct scope alignment",
  "Other floor correction",
];

export const StageNavigator: React.FC<StageNavigatorProps> = ({
  currentStage,
  orderId,
  userRole = "admin",
  userName = "Admin User",
  onJumpStage,
  isLoading = false,
  selectedStages,
}) => {
  // The real next stage in THIS order's own pipeline — never a blind +1.
  // null means the order is already at the last stage its pipeline includes.
  const resolvedNextStage = getNextSelectedStage(currentStage, selectedStages);
  const isStageInPipeline = (stageId: number) => !selectedStages || selectedStages.includes(stageId);
  const [selectedTargetStage, setSelectedTargetStage] = useState<number | "">("");
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [customNotes, setCustomNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);

  // Direct stage control (including backward rollback and multi-stage skips)
  // is a production_planning write action per the central permission matrix
  // (src/lib/permissions.ts) — admin/super_admin/production_manager, not
  // merchandiser (read-only on this module) and not customer.
  const canControlStage = hasPermission(userRole, "production_planning", "update");
  const isAdmin = canControlStage;

  if (!canControlStage) {
    return null;
  }

  const handleSelectStage = (stageId: number) => {
    setIsOpenDropdown(false);
    if (stageId === currentStage) return;

    setSelectedTargetStage(stageId);

    // Only the order's own real next pipeline stage counts as a plain,
    // no-justification-needed "standard forward advance" — for a selective
    // pipeline that's frequently NOT currentStage+1 (e.g. Sewing-only skips
    // straight from 3 to 7), so gating this on the absolute +1 number would
    // wrongly demand a reason for perfectly ordinary forward progress.
    // Backward jumps and any other stage (including one this order's
    // pipeline doesn't even include) still require justification.
    if (stageId < currentStage || stageId !== resolvedNextStage) {
      setShowReasonModal(true);
    } else {
      // Direct forward +1 advance
      executeJump(stageId, "Standard step-by-step stage advancement");
    }
  };

  const executeJump = async (stageId: number, reason: string) => {
    setIsSubmitting(true);
    try {
      await onJumpStage(stageId, reason);
      setShowReasonModal(false);
      setSelectedTargetStage("");
      setCustomNotes("");
    } catch (err) {
      console.error("Stage jump failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmModal = () => {
    if (!selectedTargetStage) return;
    const finalReason = customNotes.trim()
      ? `${selectedReason}: ${customNotes.trim()}`
      : selectedReason;
    executeJump(Number(selectedTargetStage), finalReason);
  };

  const currentStageDef = STAGES.find((s) => s.id === currentStage) || STAGES[0];
  const CurrentIcon = STAGE_ICONS[currentStage] || Layers;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Current Stage Indicator */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-2xs">
            <CurrentIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                Stage {currentStage} of 13
              </span>
              <span className="text-xs font-semibold text-neutral-400">·</span>
              <span className="text-xs text-neutral-500 font-medium">Direct Stage Controller</span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-neutral-900 mt-0.5">
              {currentStageDef.name}
            </h4>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 relative">
          
          {/* Stage Dropdown Selector */}
          <div className="relative w-full sm:w-auto">
            <button
              type="button"
              disabled={isLoading || isSubmitting}
              onClick={() => setIsOpenDropdown(!isOpenDropdown)}
              className="w-full sm:w-64 h-11 px-3.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-800 flex items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer focus:ring-2 focus:ring-amber-500/20"
            >
              <div className="flex items-center gap-2 truncate">
                <GitFork className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">Jump to CMT Stage...</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${isOpenDropdown ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpenDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsOpenDropdown(false)} />
                <div className="absolute right-0 top-12 z-40 w-80 sm:w-96 max-h-96 overflow-y-auto bg-white rounded-2xl border border-neutral-200 shadow-2xl p-2 space-y-1 animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Select CMT Stage
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                      Direct Stage Jump
                    </span>
                  </div>

                  {STAGES.map((stg) => {
                    const Icon = STAGE_ICONS[stg.id] || Layers;
                    const isCurrent = stg.id === currentStage;
                    const isBackward = stg.id < currentStage;
                    const isNext = stg.id === resolvedNextStage;
                    const isFarForward = stg.id > currentStage + 1;
                    const notInPipeline = !isCurrent && !isStageInPipeline(stg.id);
                    const isDisabled = isCurrent;

                    return (
                      <button
                        key={stg.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectStage(stg.id)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-colors ${
                          isCurrent
                            ? "bg-amber-500/10 text-amber-900 border border-amber-500/20 font-bold"
                            : "hover:bg-neutral-100 text-neutral-800 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? "bg-amber-600 text-white"
                                : isBackward
                                ? "bg-rose-100 text-rose-700"
                                : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="font-semibold truncate">
                              {stg.id}. {stg.name}
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate">
                              Output: {stg.output}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 text-[10px] font-semibold">
                          {isCurrent && (
                            <span className="text-amber-700 font-bold">Current</span>
                          )}
                          {isBackward && isAdmin && (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              <RotateCcw className="w-3 h-3" /> Rollback
                            </span>
                          )}
                          {isNext && (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <ArrowRight className="w-3 h-3" /> Next
                            </span>
                          )}
                          {isFarForward && isAdmin && !notInPipeline && (
                            <span className="text-purple-600 flex items-center gap-0.5">
                              <Sparkles className="w-3 h-3" /> Skip
                            </span>
                          )}
                          {notInPipeline && (
                            <span className="text-neutral-400 italic" title="This order's selected services don't include this stage">
                              Not in this order's pipeline
                            </span>
                          )}
                          {isDisabled && (
                            <Lock className="w-3 h-3 text-neutral-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Quick Next Stage Advance Button — targets this order's real
              next pipeline stage (never a blind +1, which previously let
              e.g. a Sewing-only order land on Stage 4, a stage that only
              belongs to a Cutting-inclusive pipeline). */}
          {resolvedNextStage !== null && (
            <button
              type="button"
              disabled={isLoading || isSubmitting}
              onClick={() => handleSelectStage(resolvedNextStage)}
              className="h-11 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <span>Advance to Stage {resolvedNextStage}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Justification / Reason Modal for Backward Jumps or Skips */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 max-w-md w-full space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5 text-amber-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Confirm Stage Transition</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>Transition:</span>
                <span className="font-mono text-neutral-800">Stage {currentStage}</span>
                <ArrowRight className="w-3 h-3 text-amber-600" />
                <span className="font-mono font-bold text-amber-800">Stage {selectedTargetStage}</span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                {Number(selectedTargetStage) < currentStage
                  ? "This is a backward rollback. An audit trail log will be permanently recorded for compliance and QC review."
                  : "This is a multi-stage jump forward. An admin authorization audit log will be created."}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Primary Reason for Jump *
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-800 bg-white focus:ring-2 focus:ring-amber-500/20"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1">
                  Floor Supervisor Notes & Corrective Actions
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Provide additional context for this stage change..."
                  className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs text-neutral-800 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmModal}
                className="px-5 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 shadow-sm flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>Authorize Jump</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
