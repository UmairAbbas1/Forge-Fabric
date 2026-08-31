import { createFileRoute } from '@tanstack/react-router';
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

export const Route = createFileRoute('/apply/new')({
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
    clearDraft
  } = useApplyWizard();
  const [dismissModal, setDismissModal] = useState(false);

  const stepNumber = state.step || 1;

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

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        
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
