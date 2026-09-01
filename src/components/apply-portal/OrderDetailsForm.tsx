import React, { useEffect } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { StyleBlockEditor } from './StyleBlockEditor';
import { calculateTargetDeliveryDateForContractTerm } from '../../lib/utils';
import { 
  Layers, 
  Plus, 
  Calendar, 
  Clock, 
  Tag, 
  ArrowLeft, 
  ArrowRight, 
  Package
} from 'lucide-react';

export const OrderDetailsForm: React.FC = () => {
  const {
    state,
    updateBlanketPo,
    addStyleBlock,
    updateStyleBlock,
    removeStyleBlock,
    duplicateStyleBlock,
    nextStep,
    prevStep,
    setStep,
    saveDraftNow,
  } = useApplyWizard();

  const { blanketPo, styleBlocks = [] } = state;

  // This screen (multi-style Blanket PO terms) is Bulk-only — a Sample
  // Request's step 2 equivalent is SampleRequestSubform, rendered inline in
  // step 1. Guards against any path landing a sample here anyway (a direct
  // Stepper click, a stale Back navigation) rather than assuming
  // SampleRequestSubform's own step-routing is the only way in.
  useEffect(() => {
    if (state.companyInfo.order_type === 'sample_request') {
      setStep(1);
    }
  }, [state.companyInfo.order_type, setStep]);

  // Calculate order grand total across all style blocks
  const totalOrderUnits = styleBlocks.reduce(
    (sum, sb) => sum + (sb.line_total || 0),
    0
  );

  // Sync Blanket PO total quantity
  useEffect(() => {
    if (totalOrderUnits > 0 && blanketPo.contract_quantity !== totalOrderUnits) {
      updateBlanketPo({ contract_quantity: totalOrderUnits });
    }
  }, [totalOrderUnits, blanketPo.contract_quantity, updateBlanketPo]);

  const handleBlanketPoChange = (field: keyof typeof blanketPo, value: any) => {
    // Picking a contract commitment term implies a target delivery date —
    // a 6-Month Season Contract targets delivery 6 months out, etc. Always
    // recalculated from today when the term changes, so it can't drift out
    // of sync with whatever term is currently selected; the date field
    // itself stays editable afterward for a manual override. 'One-time'
    // has no implied duration, so the date is left for manual entry.
    if (field === 'contract_duration') {
      const impliedDate = calculateTargetDeliveryDateForContractTerm(value);
      updateBlanketPo({
        contract_duration: value,
        ...(impliedDate ? { target_delivery_date: impliedDate } : {}),
      });
      return;
    }
    updateBlanketPo({ [field]: value });
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      const inputType = (e.target as HTMLInputElement).type;
      if (inputType !== 'submit' && inputType !== 'button') {
        e.preventDefault();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalOrderUnits <= 0) {
      alert('Please enter at least 1 unit in your style matrix before proceeding.');
      return;
    }

    saveDraftNow();
    nextStep();
  };

  return (
    <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
      {/* Header */}
      <div className="border-b border-neutral-100 pb-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
              Multi-Style Production Order &amp; Matrix Specs
            </h2>
            <p className="text-xs md:text-sm text-neutral-500">
              Configure contract timeline, garment product types, size templates, and style matrix quantities for your PO.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-8">
        
        {/* Section 1: Blanket PO Contract Parameters */}
        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>1. Blanket Purchase Order Terms</span>
            </h3>
            <div className="text-xs font-black text-blue-900 bg-blue-100 px-3 py-1 rounded-xl">
              Contract Total: {totalOrderUnits} pcs ({styleBlocks.length} Style Blocks)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Contract Commitment Term
              </label>
              <select
                value={blanketPo.contract_duration}
                onChange={(e) => handleBlanketPoChange('contract_duration', e.target.value)}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="One-time">One-time Batch Run</option>
                <option value="3 months">3-Month Rolling Blanket PO</option>
                <option value="6 months">6-Month Season Contract</option>
                <option value="12 months">12-Month Annual Framework</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Target Fabric In-House Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="date"
                  value={blanketPo.expected_start_date}
                  onChange={(e) => handleBlanketPoChange('expected_start_date', e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-neutral-300 text-xs font-bold bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Target Delivery / Ex-Factory Date
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="date"
                  value={blanketPo.target_delivery_date}
                  onChange={(e) => handleBlanketPoChange('target_delivery_date', e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-neutral-300 text-xs font-bold bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Style Blocks (Multi-Style Order Intake) */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>2. Order Style Blocks ({styleBlocks.length} Styles)</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">
                Configure products, quantities, and trims specifications for your purchase order.
              </p>
            </div>

            <button
              type="button"
              onClick={() => addStyleBlock()}
              className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Style</span>
            </button>
          </div>

          {/* Style Block Editors */}
          <div className="space-y-6">
            {styleBlocks.map((block, idx) => (
              <StyleBlockEditor
                key={block.id}
                block={block}
                blockIndex={idx}
                totalBlocks={styleBlocks.length}
                onUpdate={(updates) => updateStyleBlock(block.id, updates)}
                onRemove={() => removeStyleBlock(block.id)}
                onDuplicate={() => duplicateStyleBlock(block.id)}
              />
            ))}
          </div>

          {/* Bottom Add Style Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => addStyleBlock()}
              className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-neutral-300 cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 text-[#0071E3]" />
              <span>Add Style</span>
            </button>
          </div>
        </div>

        {/* Actions & Navigation */}
        <div className="pt-6 border-t border-neutral-100 flex justify-between items-center gap-4">
          <button
            type="button"
            onClick={prevStep}
            className="h-11 px-6 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            type="submit"
            className="h-11 px-7 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </form>
    </div>
  );
};
