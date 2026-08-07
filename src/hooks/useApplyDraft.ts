import { useState, useEffect } from 'react';
import { useApplyWizard, getDraftStorageKey } from '../contexts/ApplyWizardContext';

export function useApplyDraft() {
  const { state, loadSavedDraft, clearDraft, saveDraftNow } = useApplyWizard();
  const [hasPrompted, setHasPrompted] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ companyName?: string; lastSaved?: string; step?: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || hasPrompted) return;

    // Check if anonymous or current email draft exists
    const key = getDraftStorageKey(state.companyInfo.contact_email);
    const raw = localStorage.getItem(key) || localStorage.getItem(getDraftStorageKey());
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.companyInfo?.company_name || parsed.step > 1)) {
          setDraftInfo({
            companyName: parsed.companyInfo?.company_name,
            lastSaved: parsed.lastSavedAt,
            step: parsed.step,
          });
          setShowRecoveryModal(true);
        }
      } catch {
        // ignore
      }
    }
    setHasPrompted(true);
  }, [hasPrompted, state.companyInfo.contact_email]);

  const handleAcceptRecovery = () => {
    loadSavedDraft();
    setShowRecoveryModal(false);
  };

  const handleDismissRecovery = () => {
    setShowRecoveryModal(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowRecoveryModal(false);
    setDraftInfo(null);
  };

  return {
    showRecoveryModal,
    draftInfo,
    handleAcceptRecovery,
    handleDismissRecovery,
    handleDiscardDraft,
    saveDraftNow,
  };
}
