import React from 'react';
import { WIZARD_STEPS } from './Stepper';

interface MobileStepperProps {
  currentStep: number;
}

export const MobileStepper: React.FC<MobileStepperProps> = ({ currentStep }) => {
  const currentItem = WIZARD_STEPS.find((s) => s.step === currentStep) || WIZARD_STEPS[0];
  const progressPercent = ((currentStep) / WIZARD_STEPS.length) * 100;

  return (
    <div className="lg:hidden w-full bg-white border border-neutral-200/90 rounded-xl p-4 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs">
            {currentStep}
          </span>
          <div>
            <h4 className="text-xs font-bold text-neutral-900">{currentItem.title}</h4>
            <p className="text-[10px] text-neutral-500">{currentItem.subtitle}</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-neutral-500">
          Step {currentStep} of {WIZARD_STEPS.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-amber-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
