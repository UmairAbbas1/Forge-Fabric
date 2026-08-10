import React, { useEffect } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { SizeMatrixGrid } from './SizeMatrixGrid';
import { 
  Layers, 
  Scissors, 
  Calendar, 
  Clock, 
  Tag, 
  Droplet, 
  Sparkles, 
  Zap, 
  ArrowLeft, 
  ArrowRight, 
  AlertTriangle 
} from 'lucide-react';

const WASH_PRESETS = [
  { id: 'Raw / Rigid', name: 'Raw / Rigid (No Wash)' },
  { id: 'Enzyme Stone Wash', name: 'Enzyme Stone Wash (Medium Vintage)' },
  { id: 'Ozone Bio Wash', name: 'Ozone Bio Wash (Eco Low-Water)' },
  { id: 'Bleach Light', name: 'Bleach Light / 90s Light Indigo' },
  { id: 'Hand Sanded & Tinted', name: 'Hand Sanded, 3D Whiskers & Tint' },
  { id: 'Black Stay-Dark', name: 'Sulfur Black Stay-Dark Enzyme' },
  { id: 'Custom Wash', name: 'Custom Wash (Recipe / Reference Sample Provided)' },
];

const INSEAM_OPTIONS = ['30', '32', '34', '36', '38', 'Unhemmed (37")'];

export const OrderDetailsForm: React.FC = () => {
  const { state, updateBlanketPo, updateWorkOrder, nextStep, prevStep, saveDraftNow } = useApplyWizard();
  const { blanketPo, workOrder, sizeMatrix } = state;

  // Sync Blanket PO total units with SizeMatrix grand total
  useEffect(() => {
    if (sizeMatrix.grand_total > 0 && blanketPo.contract_quantity !== sizeMatrix.grand_total) {
      updateBlanketPo({ contract_quantity: sizeMatrix.grand_total });
    }
  }, [sizeMatrix.grand_total, blanketPo.contract_quantity, updateBlanketPo]);

  const handleBlanketPoChange = (field: keyof typeof blanketPo, value: any) => {
    updateBlanketPo({ [field]: value });
  };

  const handleWorkOrderChange = (field: keyof typeof workOrder, value: any) => {
    updateWorkOrder({ [field]: value });
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
    if (sizeMatrix.grand_total <= 0) {
      alert('Please enter at least 1 unit in the Size Matrix before proceeding.');
      return;
    }

    if (workOrder.priority === 'Rush' && !workOrder.rush_fee_acknowledged) {
      alert('Please acknowledge the Rush Production surcharge terms.');
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
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
              Blanket PO Contract &amp; Style Matrix
            </h2>
            <p className="text-xs md:text-sm text-neutral-500">
              Configure production contract duration, styling details, wash formulation, and size breakdown.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-8">
        
        {/* Section 1: Blanket PO Contract Parameters */}
        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-700" />
            <span>1. Blanket Purchase Order Terms</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Contract Quantity (Derived from Matrix) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Total Units (Pcs)
              </label>
              <div className="relative">
                <input
                  type="number"
                  readOnly
                  value={blanketPo.contract_quantity}
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm font-mono font-bold text-amber-900 cursor-not-allowed shadow-2xs"
                />
              </div>
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Auto-calculated from size matrix
              </span>
            </div>

            {/* Contract Duration */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Contract Period
              </label>
              <select
                value={blanketPo.contract_duration}
                onChange={(e) => handleBlanketPoChange('contract_duration', e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                <option value="One-time">One-time Production Run</option>
                <option value="3 months">3 Months Standing PO</option>
                <option value="6 months">6 Months Blanket Contract</option>
                <option value="12 months">12 Months Annual Program</option>
              </select>
            </div>

            {/* Target Production Start */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Expected Start Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="date"
                  required
                  value={blanketPo.expected_start_date}
                  onChange={(e) => handleBlanketPoChange('expected_start_date', e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Target Delivery Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Target Ex-Factory Date
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="date"
                  required
                  value={blanketPo.target_delivery_date}
                  onChange={(e) => handleBlanketPoChange('target_delivery_date', e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Garment Style Specifications */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-4 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-700" />
            <span>2. Style &amp; Wash Specifications</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Style Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Style Name / Model *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WSM-M260 PAUL 5 PKT JEAN"
                value={workOrder.style_name}
                onChange={(e) => handleWorkOrderChange('style_name', e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm font-bold uppercase focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
            </div>

            {/* Style Code / Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Style SKU / Cut Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WDLEG-R-DIN"
                value={workOrder.style_number}
                onChange={(e) => handleWorkOrderChange('style_number', e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 font-mono text-sm font-bold uppercase focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
            </div>

            {/* Primary Colorway */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Primary Colorway *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DEEP INDIGO"
                value={workOrder.colorway}
                onChange={(e) => handleWorkOrderChange('colorway', e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm font-bold uppercase focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
            </div>

            {/* Wash Formulation Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Wash &amp; Finish Recipe *
              </label>
              <select
                value={workOrder.wash_type}
                onChange={(e) => handleWorkOrderChange('wash_type', e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                {WASH_PRESETS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Inseam Length */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Inseam Length (Inches)
              </label>
              <select
                value={workOrder.inseam}
                onChange={(e) => handleWorkOrderChange('inseam', e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                {INSEAM_OPTIONS.map((ins) => (
                  <option key={ins} value={ins}>
                    {ins}
                  </option>
                ))}
              </select>
            </div>

            {/* Production Priority */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Production Priority
              </label>
              <select
                value={workOrder.priority}
                onChange={(e) => handleWorkOrderChange('priority', e.target.value)}
                className={`w-full h-11 px-3 rounded-xl border font-bold text-xs shadow-2xs ${
                  workOrder.priority === 'Rush'
                    ? 'border-red-400 bg-red-50/40 text-red-900'
                    : 'border-neutral-300 bg-white text-neutral-800'
                }`}
              >
                <option value="Normal">Normal Scheduling (3–4 weeks standard)</option>
                <option value="Rush">Rush Expedited (10–14 business days)</option>
              </select>
            </div>
          </div>

          {/* Rush Order Disclaimer */}
          {workOrder.priority === 'Rush' && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-bold">
                    Rush Priority Expedited Terms:
                  </p>
                  <p className="text-red-800 leading-relaxed">
                    Expedited cutting and sewing will be scheduled into our Bay Area express line. A 20% rush surcharge applies to CMT units.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-red-950 pt-1">
                    <input
                      type="checkbox"
                      checked={workOrder.rush_fee_acknowledged || false}
                      onChange={(e) => handleWorkOrderChange('rush_fee_acknowledged', e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span>I acknowledge and approve the expedited schedule terms</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Service Scope / Starting Stage Selector */}
          <div className="mt-6 pt-6 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-800 block">
                  Service Scope &amp; Initial Production Stage
                </label>
                <p className="text-[11px] text-neutral-500">
                  Select your manufacturing scope. If supplying pre-stitched jeans or cut panels, we will start directly at your chosen stage.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                Starts at Stage {workOrder.starting_stage || 1}/13
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Full CMT */}
              <button
                type="button"
                onClick={() => {
                  handleWorkOrderChange('service_scope', 'full_cmt');
                  handleWorkOrderChange('starting_stage', 1);
                  handleWorkOrderChange('starting_stage_notes', 'Full end-to-end CMT manufacturing');
                }}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  (!workOrder.service_scope || workOrder.service_scope === 'full_cmt')
                    ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-1 ring-amber-500'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="text-xs font-bold text-neutral-900 mb-1 flex items-center justify-between">
                  <span>Full CMT Package</span>
                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono">Stage 1</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  Complete fabric receiving, CAD marker cutting, sewing assembly, wash &amp; packaging.
                </p>
              </button>

              {/* Option 2: Sewing Only */}
              <button
                type="button"
                onClick={() => {
                  handleWorkOrderChange('service_scope', 'sew_only');
                  handleWorkOrderChange('starting_stage', 6);
                  handleWorkOrderChange('starting_stage_notes', 'Customer supplies pre-cut panels (Sewing Assembly Only)');
                }}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  workOrder.service_scope === 'sew_only'
                    ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-1 ring-amber-500'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="text-xs font-bold text-neutral-900 mb-1 flex items-center justify-between">
                  <span>Sewing Only</span>
                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono">Stage 6</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  You provide pre-cut garment panels. We assemble and construct the jeans.
                </p>
              </button>

              {/* Option 3: Wash & Laundry Only */}
              <button
                type="button"
                onClick={() => {
                  handleWorkOrderChange('service_scope', 'wash_only');
                  handleWorkOrderChange('starting_stage', 9);
                  handleWorkOrderChange('starting_stage_notes', 'Customer supplies pre-stitched jeans (Wash & Laundry Only)');
                }}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  workOrder.service_scope === 'wash_only'
                    ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-1 ring-amber-500'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="text-xs font-bold text-neutral-900 mb-1 flex items-center justify-between">
                  <span>Wash &amp; Laundry Only</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">Stage 9</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  You provide already-stitched jeans. We handle industrial wash, enzyme stones &amp; drying.
                </p>
              </button>

              {/* Option 4: Finishing & Pack */}
              <button
                type="button"
                onClick={() => {
                  handleWorkOrderChange('service_scope', 'finish_only');
                  handleWorkOrderChange('starting_stage', 12);
                  handleWorkOrderChange('starting_stage_notes', 'Customer supplies washed garments (Finishing & Pack Only)');
                }}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  workOrder.service_scope === 'finish_only'
                    ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-1 ring-amber-500'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="text-xs font-bold text-neutral-900 mb-1 flex items-center justify-between">
                  <span>Finishing &amp; Pack</span>
                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono">Stage 12</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-snug">
                  You provide washed garments. We handle hardware trimming, pressing, tagging &amp; carton export.
                </p>
              </button>
            </div>

            {workOrder.starting_stage && workOrder.starting_stage > 1 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-950 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse shrink-0" />
                <span>
                  <strong>Direct Jump Configured:</strong> This order will initiate directly at <strong>Stage {workOrder.starting_stage}</strong> upon merchandiser approval.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Dynamic Size Matrix Grid */}
        <div className="pt-4 border-t border-neutral-100">
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              3. Size Matrix &amp; Fabric Breakdown
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Enter target quantities by size for each fabric colorway. You can paste spreadsheet cells directly or import a .xlsx file.
            </p>
          </div>

          {/* Embedded Dynamic Matrix */}
          <SizeMatrixGrid />
        </div>

        {/* Actions & Navigation */}
        <div className="pt-6 border-t border-neutral-100 flex justify-between items-center gap-4">
          <button
            type="button"
            onClick={prevStep}
            className="h-12 px-6 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="submit"
            className="h-12 px-8 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span>Continue to Cut Sheet Ticket</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </form>
    </div>
  );
};
