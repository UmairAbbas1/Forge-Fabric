import React from 'react';
import { Check, Building2, Layers, Scissors, FileUp, ClipboardCheck } from 'lucide-react';

interface StepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const WIZARD_STEPS = [
  { step: 1, title: 'Brand & Contact', subtitle: 'Brand profile & intake', icon: Building2 },
  { step: 2, title: 'Order & Sizes', subtitle: 'Blanket PO & matrix', icon: Layers },
  { step: 3, title: 'Cut Sheet Ticket', subtitle: 'Factory spreads & yield', icon: Scissors },
  { step: 4, title: 'Document Vault', subtitle: 'Tech packs & swatches', icon: FileUp },
  { step: 5, title: 'Review & Submit', subtitle: 'Terms & dispatch', icon: ClipboardCheck },
];

export const Stepper: React.FC<StepperProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="hidden lg:block w-full bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-xs mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background Connecting Line */}
        <div className="absolute top-6 left-10 right-10 h-0.5 bg-neutral-200 -z-0" />
        
        {/* Active Progress Colored Line */}
        <div 
          className="absolute top-6 left-10 h-0.5 bg-[#0071E3] transition-all duration-300 -z-0"
          style={{ width: `${((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100 * 0.88}%` }}
        />

        {WIZARD_STEPS.map((item) => {
          const isDone = item.step < currentStep;
          const isCurrent = item.step === currentStep;
          const isFuture = item.step > currentStep;
          const Icon = item.icon;

          return (
            <button
              key={item.step}
              type="button"
              disabled={isFuture}
              onClick={() => onStepClick && onStepClick(item.step)}
              className={`flex flex-col items-center group relative z-10 transition-all ${
                isFuture ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              {/* Step Circle */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                  isDone
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isCurrent
                    ? 'bg-[#0071E3] text-white ring-4 ring-blue-100 shadow-md scale-105'
                    : 'bg-neutral-100 text-neutral-500 border border-neutral-300 group-hover:bg-neutral-200'
                }`}
              >
                {isDone ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Icon className="w-5 h-5" />}
              </div>

              {/* Step Labels */}
              <div className="mt-2.5 text-center">
                <span
                  className={`block text-[11px] font-bold tracking-wider uppercase ${
                    isCurrent ? 'text-[#0071E3]' : isDone ? 'text-neutral-700' : 'text-neutral-400'
                  }`}
                >
                  Step {item.step}
                </span>
                <span
                  className={`block text-xs font-semibold mt-0.5 ${
                    isCurrent ? 'text-neutral-900' : isDone ? 'text-neutral-700' : 'text-neutral-400'
                  }`}
                >
                  {item.title}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
