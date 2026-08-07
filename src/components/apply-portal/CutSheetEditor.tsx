import React, { useState } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { useCutSheetParser } from '../../hooks/useCutSheetParser';
import { FactoryOneTemplate } from './FactoryOneTemplate';
import { WeissmadeTemplate } from './WeissmadeTemplate';
import { SameSampleTemplate } from './SameSampleTemplate';
import { PrintLayout } from './PrintLayout';
import type { SheetType } from '../../lib/types';
import { 
  Scissors, 
  Layers, 
  Sparkles, 
  Download, 
  Printer, 
  ArrowLeft, 
  ArrowRight, 
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

export const CutSheetEditor: React.FC = () => {
  const { state, updateCutSheet, nextStep, prevStep, saveDraftNow } = useApplyWizard();
  const { cutSheetType } = state;
  const { downloadBlankTemplate, exportCutSheetToExcel } = useCutSheetParser();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const handleTemplateSwitch = (type: SheetType) => {
    updateCutSheet(type, { sheet_type: type });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveDraftNow();
    nextStep();
  };

  return (
    <>
      {/* Hidden Print Ticket (visible only on @media print) */}
      <PrintLayout state={state} />

      {/* Screen Interface */}
      <div className="no-print bg-white border border-neutral-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
        
        {/* Header */}
        <div className="border-b border-neutral-100 pb-6 mb-8 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
                Cut Sheet Ticket &amp; Factory Specifications
              </h2>
              <p className="text-xs md:text-sm text-neutral-500">
                Review spread yields, component yards, and trims. Choose your preferred factory template.
              </p>
            </div>
          </div>

          {/* Quick Action Tools: Blank Templates, Export XLSX, Print */}
          <div className="flex items-center gap-2 relative">
            
            {/* Blank Template Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="h-10 px-3 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
              >
                <Download className="w-3.5 h-3.5 text-neutral-500" />
                <span>Download Blank Template</span>
              </button>

              {showTemplateMenu && (
                <div className="absolute right-0 top-12 z-30 w-56 bg-white rounded-xl border border-neutral-200 shadow-xl p-2 animate-in fade-in space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      downloadBlankTemplate('factory_one_production');
                      setShowTemplateMenu(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-amber-50 font-medium text-neutral-800"
                  >
                    1. Factory One Cut Ticket (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadBlankTemplate('weissmade_size_matrix');
                      setShowTemplateMenu(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-amber-50 font-medium text-neutral-800"
                  >
                    2. Weissmade Size Matrix (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadBlankTemplate('same_sample_request');
                      setShowTemplateMenu(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-amber-50 font-medium text-neutral-800"
                  >
                    3. SAME Sample Request (.xlsx)
                  </button>
                </div>
              )}
            </div>

            {/* Export Cut Sheet */}
            <button
              type="button"
              onClick={() => exportCutSheetToExcel(state.cutSheetData)}
              className="h-10 px-3 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export Cut Ticket</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Template Format Switcher Tabs */}
        <div className="flex gap-2 p-1.5 bg-neutral-100 rounded-xl mb-8 border border-neutral-200/80 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTemplateSwitch('factory_one_production')}
            className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              cutSheetType === 'factory_one_production'
                ? 'bg-white text-amber-950 shadow-xs ring-1 ring-neutral-200'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Factory One Production</span>
          </button>

          <button
            type="button"
            onClick={() => handleTemplateSwitch('weissmade_size_matrix')}
            className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              cutSheetType === 'weissmade_size_matrix'
                ? 'bg-white text-amber-950 shadow-xs ring-1 ring-neutral-200'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Weissmade Size Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => handleTemplateSwitch('same_sample_request')}
            className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              cutSheetType === 'same_sample_request'
                ? 'bg-white text-amber-950 shadow-xs ring-1 ring-neutral-200'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SAME Sample Request</span>
          </button>
        </div>

        {/* Active Template Renderer */}
        <div className="mb-10">
          {cutSheetType === 'factory_one_production' && <FactoryOneTemplate />}
          {cutSheetType === 'weissmade_size_matrix' && <WeissmadeTemplate />}
          {cutSheetType === 'same_sample_request' && <SameSampleTemplate />}
        </div>

        {/* Actions & Navigation */}
        <div className="pt-6 border-t border-neutral-100 flex justify-between items-center gap-4">
          <button
            type="button"
            onClick={prevStep}
            className="h-12 px-6 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Order Details</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="h-12 px-8 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span>Continue to Document Vault</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </>
  );
};
