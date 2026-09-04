import { createFileRoute, useNavigate, useBlocker } from '@tanstack/react-router';
import { ApplyWizardProvider, useApplyWizard } from '../contexts/ApplyWizardContext';
import { ApplyLayout } from '../components/apply-portal/ApplyLayout';
import { Stepper } from '../components/apply-portal/Stepper';
import { MobileStepper } from '../components/apply-portal/MobileStepper';
import { DraftRecoveryModal } from '../components/apply-portal/DraftRecoveryModal';
import { CompanyInfoForm } from '../components/apply-portal/CompanyInfoForm';
import { OrderDetailsForm } from '../components/apply-portal/OrderDetailsForm';
import { CutSheetEditor } from '../components/apply-portal/CutSheetEditor';
import { DocumentUploader } from '../components/apply-portal/DocumentUploader';
import { ReviewSummary } from '../components/apply-portal/ReviewSummary';
import { useEffect, useRef, useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

// Deep-link from /apply/update (and any other entry point that wants to
// land directly on a specific order type) — pre-selects the Order
// Classification card instead of leaving the customer to click it manually.
// `ref` additionally pre-selects a specific PO/reference code inside the
// Order Update subform (e.g. "Request Change" on an order's own detail
// page), same deep-link convention used by cutting/sewing/wash/qc/dispatch.
const searchSchema = z.object({
  type: z.enum(['new_order', 'sample_request', 'rush_order', 'update_existing']).optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute('/apply/new')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ApplyNewPageWrapper,
});

function ApplyNewPageWrapper() {
  return (
    <ApplyWizardProvider>
      <ApplyWizardContainer />
    </ApplyWizardProvider>
  );
}

function ApplyWizardContainer() {
  const {
    state,
    setStep,
    hasSavedDraft,
    savedDraftInfo,
    loadSavedDraft,
    clearDraft,
    saveDraftNow,
    hasUnsavedChanges,
    updateCompanyInfo,
  } = useApplyWizard();
  const [dismissModal, setDismissModal] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const navigate = useNavigate();
  const { type: deepLinkOrderType, ref: deepLinkRef } = Route.useSearch();
  const deepLinkHandled = useRef(false);

  // Only pre-select the classification once, and only into a still-blank
  // wizard — never override a real, in-progress draft the customer already
  // has open (a second visit to this same tab with the param present
  // shouldn't silently reset their order type mid-application).
  useEffect(() => {
    if ((!deepLinkOrderType && !deepLinkRef) || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    if (!state.companyInfo.company_name && !state.documents.length) {
      updateCompanyInfo({
        ...(deepLinkOrderType ? { order_type: deepLinkOrderType } : {}),
        ...(deepLinkRef ? { existing_order_reference: deepLinkRef } : {}),
      });
    }
  }, [deepLinkOrderType, deepLinkRef, state.companyInfo.company_name, state.documents.length, updateCompanyInfo]);

  const stepNumber = state.step || 1;

  // In-app navigation guard: only blocks (and only warns) when there are
  // genuinely unsaved changes — silent otherwise. enableBeforeUnload mirrors
  // the same condition for tab-close/browser-back, using the router's own
  // native mechanism rather than a second hand-rolled beforeunload handler.
  useBlocker({
    shouldBlockFn: () => {
      if (!hasUnsavedChanges) return false;
      return !window.confirm(
        'You have unsaved changes on this application. Leaving now will lose them unless you use "Save & Exit" first.\n\nLeave anyway?'
      );
    },
    enableBeforeUnload: () => hasUnsavedChanges,
  });

  const handleSaveAndExit = () => {
    saveDraftNow();
    setShowSaveConfirmation(true);
    setTimeout(() => {
      navigate({ to: '/dashboard' });
    }, 1400);
  };

  return (
    <ApplyLayout title="Order Intake Application">
      <DraftRecoveryModal
        isOpen={hasSavedDraft && !dismissModal}
        draftInfo={{
          companyName: savedDraftInfo?.companyName || 'Saved Draft',
          lastSaved: savedDraftInfo?.lastSavedAt || undefined,
          step: savedDraftInfo?.step,
        }}
        onResume={() => {
          loadSavedDraft();
          setDismissModal(true);
        }}
        onDiscard={() => {
          clearDraft();
          setDismissModal(true);
        }}
        onDismiss={() => {
          setDismissModal(true);
        }}
      />

      {showSaveConfirmation && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="font-bold text-base text-neutral-900">Progress Saved</h3>
            <p className="text-xs text-neutral-500">
              Your progress has been saved. You can resume this application anytime from your dashboard.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">

        {/*
          Wizard chrome (Save & Exit + both steppers) is app UI, never part
          of a printed/exported document — Step 3's own Print button (and
          any future print action on another step) renders a dedicated
          .print-only PrintLayout instead. Without this wrapper, printing or
          "Save as PDF" from the browser leaked this whole live, interactive
          shell into the output (frozen buttons, a dead stepper, no real
          document) because none of it carried the .no-print convention
          every other page uses (see AppShell.tsx, CutSheetEditor.tsx).
        */}
        <div className="no-print">
          {/* Save & Exit — visible at every step, distinct from the silent auto-save */}
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save &amp; Exit
            </button>
          </div>

          {/* Desktop Stepper */}
          <div className="hidden md:block mb-8">
            <Stepper currentStep={stepNumber} onStepClick={setStep} />
          </div>

          {/* Mobile Stepper */}
          <div className="block md:hidden mb-6">
            <MobileStepper currentStep={stepNumber} />
          </div>
        </div>

        {/* Active Step Content */}
        <div className="transition-all duration-200 ease-in-out">
          {stepNumber === 1 && <CompanyInfoForm />}
          {stepNumber === 2 && <OrderDetailsForm />}
          {stepNumber === 3 && <CutSheetEditor />}
          {stepNumber === 4 && <DocumentUploader />}
          {stepNumber === 5 && <ReviewSummary />}
        </div>

      </div>
    </ApplyLayout>
  );
}
