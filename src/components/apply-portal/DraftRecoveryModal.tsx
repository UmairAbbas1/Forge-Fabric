import React from 'react';
import { History, ArrowRight, Trash2, X } from 'lucide-react';

interface DraftRecoveryModalProps {
  isOpen: boolean;
  draftInfo: {
    companyName?: string;
    lastSaved?: string;
    step?: number;
  } | null;
  onResume: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

export const DraftRecoveryModal: React.FC<DraftRecoveryModalProps> = ({
  isOpen,
  draftInfo,
  onResume,
  onDiscard,
  onDismiss,
}) => {
  if (!isOpen) return null;

  const formattedTime = draftInfo?.lastSaved
    ? new Date(draftInfo.lastSaved).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Recently';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900">Resume Previous Application?</h3>
              <p className="text-xs text-neutral-500">We found an auto-saved draft on this device</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5 bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500 font-medium">Company Name:</span>
            <span className="text-neutral-900 font-bold">{draftInfo?.companyName || 'In Progress'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 font-medium">Last Saved:</span>
            <span className="text-neutral-900 font-mono">{formattedTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 font-medium">Saved at:</span>
            <span className="text-amber-800 font-semibold">Step {draftInfo?.step || 1} of 5</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full h-11 rounded-xl bg-amber-700 hover:bg-amber-800 text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Resume Saved Application</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onDiscard}
              className="flex-1 h-10 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 text-xs font-semibold text-red-700 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard &amp; Start Fresh</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 h-10 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 cursor-pointer transition-all"
            >
              <span>Ignore</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
