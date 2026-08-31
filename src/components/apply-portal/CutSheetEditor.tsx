import React, { useEffect, useState } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { useCutSheetParser, emptyStageProgress, type CutSheetStageProgress } from '../../hooks/useCutSheetParser';
import { FactoryOneTemplate } from './FactoryOneTemplate';
import { PrintLayout } from './PrintLayout';
import { 
  Scissors, 
  Download, 
  Printer, 
  ArrowLeft, 
  ArrowRight, 
  FileSpreadsheet
} from 'lucide-react';

export const CutSheetEditor: React.FC = () => {
  const { state, nextStep, prevStep, setStep, saveDraftNow } = useApplyWizard();
  const { downloadBlankTemplate, exportCutSheetToExcel, fetchCutSheetStageProgress } = useCutSheetParser();
  const isSample = state.companyInfo.order_type === 'sample_request';

  // Fetched once on mount so the print view (which renders synchronously via
  // window.print(), no time to await) can show the same real stage-progress
  // data the .xlsx export uses — not a fabricated placeholder while loading.
  const [stageProgress, setStageProgress] = useState<CutSheetStageProgress>(emptyStageProgress());
  useEffect(() => {
    const referenceCode = state.referenceCode || state.workOrder.style_number;
    fetchCutSheetStageProgress(referenceCode).then(setStageProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.referenceCode, state.workOrder.style_number]);

  const handlePrint = () => {
    window.print();
  };

  // Same shared export used by the merchandiser/admin download
  // (CutSheetManager.tsx) — same styleBlocks shape, same stage-progress
  // lookup, same workbook output. Most intake-time downloads will show
  // every stage as "not yet reached", correctly, since the order usually
  // hasn't been converted to production yet at this point in the wizard.
  const handleExportCutSheet = () => {
    const referenceCode = state.referenceCode || state.workOrder.style_number;
    exportCutSheetToExcel(
      state.styleBlocks,
      { referenceCode, companyName: state.companyInfo.company_name },
      stageProgress,
      state.cutSheetData
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveDraftNow();
    nextStep();
  };

  // Samples never visit step 2 (OrderDetailsForm is Bulk-only — its style
  // block editor/Blanket PO terms don't apply) — Back returns to step 1,
  // where the sample specification form actually lives.
  const handleBack = () => {
    if (isSample) {
      setStep(1);
    } else {
      prevStep();
    }
  };

  return (
    <>
      {/* Hidden Print Ticket (visible only on @media print) */}
      <PrintLayout
        companyName={state.companyInfo.company_name}
        brandName={state.companyInfo.brand_name}
        contactName={state.companyInfo.contact_name}
        contactPhone={state.companyInfo.contact_phone}
        contactEmail={state.companyInfo.contact_email}
        orderType={state.companyInfo.order_type}
        referenceCode={state.referenceCode}
        contractQuantity={state.blanketPo.contract_quantity}
        contractDuration={state.blanketPo.contract_duration}
        targetDeliveryDate={state.blanketPo.target_delivery_date}
        styleBlocks={state.styleBlocks}
        cutSheetData={state.cutSheetData}
        stageProgress={stageProgress}
      />

      {/* Screen Interface */}
      <div className="no-print bg-white border border-neutral-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
        
        {/* Header */}
        <div className="border-b border-neutral-100 pb-6 mb-8 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
                Production Cut Ticket &amp; Spec Sheet
              </h2>
              <p className="text-xs md:text-sm text-neutral-500">
                Review fabric yields, roll balances, component spreads, and repeatable trims BOM for your order.
              </p>
            </div>
          </div>

          {/* Quick Action Tools: Download Template, Export XLSX, Print */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadBlankTemplate('factory_one_production')}
              className="h-10 px-3 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Download Cut Ticket Template</span>
            </button>

            {/* Export Cut Sheet */}
            <button
              type="button"
              onClick={handleExportCutSheet}
              className="h-10 px-3 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export Cut Ticket (.xlsx)</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Cut Ticket</span>
            </button>
          </div>
        </div>

        {/* Single Universal Production Cut Ticket */}
        <div className="mb-10">
          <FactoryOneTemplate />
        </div>

        {/* Actions & Navigation */}
        <div className="pt-6 border-t border-neutral-100 flex justify-between items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="h-12 px-6 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isSample ? 'Back to Sample Specifications' : 'Back to Order Details'}</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span>Continue to Document Vault</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </>
  );
};
