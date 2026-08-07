import React from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { Sparkles, Scissors, FileText } from 'lucide-react';

export const SameSampleTemplate: React.FC = () => {
  const { state, updateCutSheet } = useApplyWizard();
  const { cutSheetData, workOrder } = state;

  const comments = cutSheetData.sheet_data?.comments || 'Pre-production counter sample for fit approval before bulk fabric cutting.';
  const samplePo = cutSheetData.sheet_data?.sample_po_number || 'SMPP-2026-SF';

  const handleChange = (field: string, value: any) => {
    updateCutSheet('same_sample_request', {
      sheet_data: {
        ...cutSheetData.sheet_data,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200 shadow-2xs space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
          <div>
            <h4 className="font-bold text-sm text-neutral-900 uppercase">
              SAME SAMPLE REQUEST &amp; COUNTER SPEC
            </h4>
            <p className="text-xs text-neutral-500">
              Expedited sampling for pattern verification and fit modeling.
            </p>
          </div>
          <span className="px-3 py-1 bg-sky-100 text-sky-900 rounded-full font-bold text-xs">
            Template: SAME Sample Format
          </span>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">
              Sample PO / Reference #
            </label>
            <input
              type="text"
              value={samplePo}
              onChange={(e) => handleChange('sample_po_number', e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-neutral-300 bg-white font-mono font-bold uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">
              Sample Garment Style
            </label>
            <input
              type="text"
              readOnly
              value={workOrder.style_name}
              className="w-full h-9 px-3 rounded-lg border border-neutral-300 bg-neutral-100 font-bold uppercase cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-neutral-600 mb-1">
              Target Finish / Wash
            </label>
            <input
              type="text"
              readOnly
              value={workOrder.wash_type}
              className="w-full h-9 px-3 rounded-lg border border-neutral-300 bg-neutral-100 font-semibold cursor-not-allowed"
            />
          </div>
        </div>

        {/* Special Instructions */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
            Special Fitting &amp; Construction Notes
          </label>
          <textarea
            rows={4}
            value={comments}
            onChange={(e) => handleChange('comments', e.target.value)}
            className="w-full p-3 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-800 leading-relaxed focus:ring-2 focus:ring-amber-500"
            placeholder="Specify any tailored fitting details, needle spacing, or special wash nuances required for this sample..."
          />
        </div>

      </div>
    </div>
  );
};
