import React from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { SizeMatrixGrid } from './SizeMatrixGrid';
import { Scissors, Sparkles } from 'lucide-react';

export const WeissmadeTemplate: React.FC = () => {
  const { state } = useApplyWizard();
  const { workOrder } = state;

  return (
    <div className="space-y-6">
      <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
          <div>
            <h4 className="font-bold text-sm text-neutral-900 uppercase">
              WEISSMADE CUT TICKET &amp; MULTI-FABRIC MATRIX
            </h4>
            <p className="text-xs text-neutral-500">
              Style: <strong>{workOrder.style_name}</strong> · Inseam: <strong>{workOrder.inseam}</strong>
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full font-bold text-xs">
            Template: Weissmade Format
          </span>
        </div>

        <div className="mt-6">
          <SizeMatrixGrid />
        </div>
      </div>
    </div>
  );
};
