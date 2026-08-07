import React from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface SubmissionProgressModalProps {
  isOpen: boolean;
  progressPercent: number;
  stageMessage: string;
}

const STAGES = [
  { id: 1, label: 'Validating order parameters & size breakdown...' },
  { id: 2, label: 'Uploading technical documents to cloud vault...' },
  { id: 3, label: 'Initializing Blanket PO & Work Order records...' },
  { id: 4, label: 'Dispatching confirmation email & reference code...' },
];

export const SubmissionProgressModal: React.FC<SubmissionProgressModalProps> = ({
  isOpen,
  progressPercent,
  stageMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-lg w-full p-8 text-center animate-in zoom-in-95 duration-200">
        
        {/* Animated Brand Spinner */}
        <div className="relative mx-auto mb-6 w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-amber-200 animate-ping opacity-25" />
          <div className="w-14 h-14 rounded-2xl bg-amber-700 text-white flex items-center justify-center shadow-lg">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-neutral-900 mb-1">
          Submitting Production Order
        </h3>
        <p className="text-xs text-neutral-500 mb-6">
          Please keep this window open while our servers process your technical files.
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-100 rounded-full h-3 mb-6 overflow-hidden border border-neutral-200">
          <div
            className="bg-amber-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progressPercent)}%` }}
          />
        </div>

        {/* 4-Step Checklist */}
        <div className="space-y-3 text-left bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs">
          {STAGES.map((s, idx) => {
            const isCompleted = progressPercent > (idx + 1) * 23;
            const isCurrent = progressPercent >= idx * 23 && progressPercent <= (idx + 1) * 23;

            return (
              <div key={s.id} className="flex items-center gap-3">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-neutral-300 shrink-0" />
                )}
                <span
                  className={`${
                    isCompleted
                      ? 'text-neutral-900 font-bold'
                      : isCurrent
                      ? 'text-amber-900 font-bold'
                      : 'text-neutral-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>256-Bit SSL Encrypted Intake Pipeline</span>
        </div>

      </div>
    </div>
  );
};
