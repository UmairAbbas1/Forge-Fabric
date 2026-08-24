import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSubmitApplication } from '../../hooks/useApplySubmission';
import { SubmissionProgressModal } from './SubmissionProgressModal';
import { 
  ClipboardCheck, 
  Building2, 
  Layers, 
  Scissors, 
  FileUp, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  Lock,
  Zap
} from 'lucide-react';

export const ReviewSummary: React.FC = () => {
  const navigate = useNavigate();
  const { 
    state, 
    setStep, 
    prevStep, 
    updateWorkOrder,
    setTermsAgreed, 
    setAccuracyConfirmed, 
    setReferenceCode,
    clearDraft 
  } = useApplyWizard();
  
  const { companyInfo, blanketPo, workOrder, sizeMatrix, cutSheetData, documents, termsAgreed, accuracyConfirmed } = state;
  const submitMutation = useSubmitApplication();
  const { branding } = useTheme();
  const liveRushMultiplier = branding.rush_multiplier;
  
  const [progressPercent, setProgressPercent] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAgreed) {
      alert('Please agree to the Manufacturing Terms & Commercial Conditions before submitting.');
      return;
    }
    if (!accuracyConfirmed) {
      alert('Please confirm that all size matrix quantities and cut specs have been verified.');
      return;
    }

    setIsModalOpen(true);
    setProgressPercent(15);
    setStageMessage('Validating order parameters & size breakdown...');

    // Progress simulation
    const p1 = setTimeout(() => setProgressPercent(45), 600);
    const p2 = setTimeout(() => setProgressPercent(75), 1400);

    try {
      const result = await submitMutation.mutateAsync(state);
      setProgressPercent(100);
      setStageMessage('Submission confirmed!');

      if (result.reference_code) {
        setReferenceCode(result.reference_code);
        clearDraft();
        setTimeout(() => {
          setIsModalOpen(false);
          navigate({
            to: '/apply/thank-you',
            search: {
              referenceCode: result.reference_code,
              email: companyInfo.contact_email,
            },
          });
        }, 800);
      }
    } catch (err: any) {
      clearTimeout(p1);
      clearTimeout(p2);
      setIsModalOpen(false);
      alert(`Submission Error: ${err.message || 'Please check your connection and try again.'}`);
    }
  };

  return (
    <>
      <SubmissionProgressModal
        isOpen={isModalOpen}
        progressPercent={progressPercent}
        stageMessage={stageMessage}
      />

      <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
        
        {/* Header */}
        <div className="border-b border-neutral-100 pb-6 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
                Order Verification &amp; Final Dispatch
              </h2>
              <p className="text-xs md:text-sm text-neutral-500">
                Please review all production parameters carefully before sending to our intake merchandisers.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleFinalSubmit} className="space-y-6">
          
          {/* Card 1: Company Profile */}
          <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-2xs">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200 mb-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-neutral-700">
                <Building2 className="w-4 h-4 text-amber-700" />
                <span>1. Company &amp; Contact</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-neutral-500 block">Company Name:</span>
                <span className="font-bold text-neutral-900">{companyInfo.company_name}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Contact Name:</span>
                <span className="font-bold text-neutral-900">{companyInfo.contact_name}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Business Email:</span>
                <span className="font-bold text-neutral-900">{companyInfo.contact_email}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Order Intent:</span>
                <span className="font-bold text-amber-800 uppercase">{companyInfo.order_type.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Blanket PO & Multi-Style Specifications */}
          <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-2xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-neutral-700">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>2. PO Contract &amp; Multi-Style Order Blocks ({state.styleBlocks?.length || 1} Styles)</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Styles</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pb-2 border-b border-neutral-200">
              <div>
                <span className="text-neutral-500 block">Contract Duration:</span>
                <span className="font-bold text-neutral-900">{blanketPo.contract_duration}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Target Delivery:</span>
                <span className="font-bold text-neutral-900">{blanketPo.target_delivery_date}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Total Styles:</span>
                <span className="font-bold text-neutral-900">{state.styleBlocks?.length || 1} Style Blocks</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Order Total:</span>
                <span className="font-mono font-black text-base text-blue-900">{blanketPo.contract_quantity} pcs</span>
              </div>
            </div>

            {/* List of Style Blocks */}
            <div className="space-y-3 pt-1">
              {(state.styleBlocks && state.styleBlocks.length > 0 ? state.styleBlocks : [
                {
                  id: 'sb-fallback',
                  product_type: 'Denim/Bottoms' as const,
                  fabric_type: 'Woven' as const,
                  style_name: workOrder.style_name,
                  style_number: workOrder.style_number,
                  colorway: workOrder.colorway,
                  wash_type: workOrder.wash_type,
                  size_columns: sizeMatrix.size_columns,
                  size_matrix: sizeMatrix.fabrics?.[0]?.size_matrix || {},
                  line_total: sizeMatrix.grand_total,
                  trims_bom: [],
                }
              ]).map((block, idx) => (
                <div key={block.id || idx} className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-neutral-900">#{idx + 1} {block.style_name}</span>
                      <span className="font-mono text-[11px] text-blue-800 font-bold px-2 py-0.5 bg-blue-50 rounded">
                        {block.style_number}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-100 text-neutral-800">
                        {block.product_type} ({block.fabric_type === 'Other' ? (block.custom_fabric_type || 'Custom Material') : block.fabric_type})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-blue-700">{block.line_total} pcs</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-neutral-600">
                    <div>Color: <strong>{block.colorway || '—'}</strong></div>
                    <div>Wash: <strong>{block.wash_type || '—'}</strong></div>
                    <div>Stage: <strong>Stage {block.starting_stage || 1}</strong></div>
                    <div>
                      {block.starting_stage === 7 ? 'Laundry Items' : block.starting_stage === 10 ? 'Finishing Items' : 'Sizes'}:{' '}
                      <span className="font-mono">
                        {block.starting_stage === 7
                          ? `${block.laundry_items?.length || 0} batch rows`
                          : block.starting_stage === 10
                          ? `${block.finishing_items?.length || 0} batch rows`
                          : block.size_columns?.join(', ')}
                      </span>
                    </div>
                  </div>

                  {block.laundry_items && block.laundry_items.length > 0 && (
                    <div className="pt-2 border-t border-amber-100 text-[10px] text-amber-900 flex items-center gap-2 flex-wrap">
                      <span className="font-bold uppercase text-amber-700">Laundry Items:</span>
                      {block.laundry_items.map((li) => (
                        <span key={li.id} className="bg-amber-100/80 px-2 py-0.5 rounded text-amber-950 font-medium">
                          {li.product_name}: {li.quantity} pcs ({li.wash_recipe})
                        </span>
                      ))}
                    </div>
                  )}

                  {block.finishing_items && block.finishing_items.length > 0 && (
                    <div className="pt-2 border-t border-blue-100 text-[10px] text-blue-900 flex items-center gap-2 flex-wrap">
                      <span className="font-bold uppercase text-blue-700">Finishing Items:</span>
                      {block.finishing_items.map((fi) => (
                        <span key={fi.id} className="bg-blue-100/80 px-2 py-0.5 rounded text-blue-950 font-medium">
                          {fi.product_name}: {fi.quantity} pcs ({fi.hangtag_type || 'Standard'})
                        </span>
                      ))}
                    </div>
                  )}

                  {block.trims_bom && block.trims_bom.length > 0 && (
                    <div className="pt-2 border-t border-neutral-100 text-[10px] text-neutral-600 flex items-center gap-2 flex-wrap">
                      <span className="font-bold uppercase text-neutral-400">Trims BOM:</span>
                      {block.trims_bom.map((t) => (
                        <span key={t.id} className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-800">
                          {t.trim_type}: {t.specification || 'Standard'} ({t.qty_per_garment} {t.uom})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Size Matrix Breakdown */}
          <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-2xs space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-neutral-700">
                <Scissors className="w-4 h-4 text-amber-700" />
                <span>3. Size Matrix Breakdown ({state.styleBlocks?.length || 0} Style Blocks)</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {state.styleBlocks && state.styleBlocks.length > 0 ? (
                state.styleBlocks.map((sb, i) => (
                  <div key={sb.id || i} className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 font-bold text-neutral-900">
                        <span>Style #{i + 1}: {sb.style_name || 'Unnamed Style'}</span>
                        {sb.style_number && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            {sb.style_number}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-amber-900 text-sm">{sb.line_total || 0} pcs</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-neutral-600 font-medium">
                      <span>Colorway: <strong>{sb.colorway || '—'}</strong></span>
                      <span>•</span>
                      <span>Fabric: <strong>{sb.fabric_type === 'Other' ? (sb.custom_fabric_type || 'Custom Material') : sb.fabric_type}</strong></span>
                      <span>•</span>
                      <span>Wash: <strong>{sb.wash_type || '—'}</strong></span>
                    </div>

                    {/* Breakdown Matrix values */}
                    {sb.size_matrix && Object.keys(sb.size_matrix).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-neutral-100">
                        {Object.entries(sb.size_matrix).map(([sz, qty]) => (
                          <span key={sz} className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-mono text-neutral-800 font-bold">
                            {sz}: {qty} pcs
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-500 italic">No style matrix entered.</p>
              )}
            </div>
          </div>

          {/* Card 4: Documents Attached */}
          <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-2xs">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-200 mb-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-neutral-700">
                <FileUp className="w-4 h-4 text-amber-700" />
                <span>4. Attached Technical Documents ({documents.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            {documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {documents.map((d) => (
                  <div key={d.id} className="bg-white p-2.5 rounded-xl border border-neutral-200 flex justify-between items-center">
                    <span className="font-bold text-neutral-900 truncate max-w-xs">{d.file_name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 shrink-0">
                      {d.category}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No technical documents attached.</p>
            )}
          </div>

          {/* Card 5: Production Priority Speed (Normal vs Rush Process) */}
          <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-neutral-700 pb-3 border-b border-neutral-200">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>5. Production Lead-Time &amp; Processing Priority</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Normal */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  workOrder.priority !== "Rush"
                    ? "border-blue-600 bg-blue-50/50 shadow-2xs"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="production_priority"
                  checked={workOrder.priority !== "Rush"}
                  onChange={() =>
                    updateWorkOrder({
                      priority: "Normal",
                      rush_multiplier: 1.0,
                      rush_fee_acknowledged: false,
                    })
                  }
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <h4 className="font-bold text-xs text-neutral-900">Standard Production Process</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Standard factory scheduling &amp; regular commercial lead-time.
                  </p>
                </div>
              </label>

              {/* Option 2: Rush */}
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  workOrder.priority === "Rush"
                    ? "border-amber-600 bg-amber-50/60 shadow-2xs"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="production_priority"
                  checked={workOrder.priority === "Rush"}
                  onChange={() =>
                    updateWorkOrder({
                      priority: "Rush",
                      rush_multiplier: liveRushMultiplier,
                      rush_fee_acknowledged: true,
                    })
                  }
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1">
                    <span>Rush Process (Expedited Lead-Time)</span>
                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-mono font-extrabold text-[10px]">
                      RUSH
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Priority line scheduling &amp; accelerated factory dispatch.
                  </p>
                </div>
              </label>
            </div>

            {/* Rush Warning Banner */}
            {workOrder.priority === "Rush" && (
              <div className="p-3.5 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 animate-in fade-in">
                <Zap className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block">Notice: Rush Process Selected</span>
                  <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                    Expedited production priority applies a <strong>{liveRushMultiplier}x standard rate</strong> multiplier, as configured in Admin Settings. This is factored into your cost estimate.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Agreements & Disclaimers */}
          <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Commercial Terms &amp; Production Confirmation</span>
            </h3>

            {/* Checkbox 1 */}
            <label className="flex items-start gap-3 cursor-pointer text-xs text-neutral-800">
              <input
                type="checkbox"
                required
                checked={accuracyConfirmed}
                onChange={(e) => setAccuracyConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-amber-700 focus:ring-amber-500"
              />
              <span>
                <strong>Technical Accuracy Confirmation:</strong> I confirm that all size breakdown quantities, fabric descriptions, wash formulations, and technical specifications provided above are accurate and ready for factory intake review.
              </span>
            </label>

            {/* Checkbox 2 */}
            <label className="flex items-start gap-3 cursor-pointer text-xs text-neutral-800">
              <input
                type="checkbox"
                required
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-amber-700 focus:ring-amber-500"
              />
              <span>
                <strong>Terms of Manufacturing:</strong> I agree to Forge &amp; Fabric Industries, Inc. standard CMT manufacturing terms, commercial lead times, and payment milestones. An intake merchandiser will review and issue official Blanket PO &amp; Work Orders within 24 business hours.
              </span>
            </label>
          </div>

          {/* Actions & Submit */}
          <div className="pt-6 border-t border-neutral-100 flex justify-between items-center gap-4">
            <button
              type="button"
              onClick={prevStep}
              className="h-12 px-6 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Documents</span>
            </button>

            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="h-14 px-10 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{submitMutation.isPending ? 'Submitting Order...' : 'Submit Production Order'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>

      </div>
    </>
  );
};
