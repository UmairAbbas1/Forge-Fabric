import { createFileRoute, useNavigate, useBlocker } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
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
import { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/apply-intake')({
  head: () => ({
    meta: [
      { title: 'Direct Order Intake · Forge & Fabric Industries, Inc.' },
      { name: 'description', content: 'Production order intake and Blanket PO submission.' },
    ],
  }),
  component: DirectIntakePageWrapper,
});

function DirectIntakePageWrapper() {
  return (
    <ApplyWizardProvider>
      <DirectIntakeWizardContainer />
    </ApplyWizardProvider>
  );
}

function DirectIntakeWizardContainer() {
  const {
    state,
    setStep,
    hasSavedDraft,
    savedDraftInfo,
    loadSavedDraft,
    clearDraft,
    saveDraftNow,
    hasUnsavedChanges,
  } = useApplyWizard();
  const [dismissModal, setDismissModal] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const navigate = useNavigate();

  const stepNumber = state.step || 1;

  useBlocker({
    shouldBlockFn: () => {
      if (!hasUnsavedChanges) return false;
      return !window.confirm(
        'You have unsaved changes on this intake application. Leaving now will lose them unless you use "Save & Exit" first.\n\nLeave anyway?'
      );
    },
    enableBeforeUnload: () => hasUnsavedChanges,
  });

  const handleSaveAndExit = () => {
    saveDraftNow();
    setShowSaveConfirmation(true);
    setTimeout(() => {
      navigate({ to: '/submissions' });
    }, 1400);
  };

  return (
    <ApplyLayout title="Direct Order Intake Application">
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
              Progress has been saved. You can resume this intake anytime from the Submissions Inbox.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">

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
