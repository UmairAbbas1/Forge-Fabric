import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { 
  ApplyCutSheet, 
  SheetType,
  WeissmadeFabricRow 
} from '../lib/types';

export interface CompanyInfo {
  company_name: string;
  brand_name?: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  website?: string;
  is_existing_customer?: boolean;
  existing_order_reference?: string;
  order_type: 'new_order' | 'sample_request' | 'rush_order' | 'update_existing';
  referral_source?: string;
  website_url_hp?: string; // Honeypot field for bot protection
}

export interface BlanketPOInfo {
  po_number_preview?: string;
  contract_quantity: number;
  contract_duration: '3 months' | '6 months' | '12 months' | 'One-time';
  expected_start_date: string;
  target_delivery_date: string;
}

export interface WorkOrderDetails {
  style_name: string;
  style_description?: string;
  style_number: string;
  colorway: string;
  wash_type: string;
  custom_wash_type?: string;
  inseam: string;
  order_type: 'Sample' | 'Bulk' | 'Rush';
  priority: 'Normal' | 'Rush';
  rush_fee_acknowledged?: boolean;
  rush_note?: string;
  service_scope?: 'full_cmt' | 'cut_make' | 'sew_only' | 'wash_only' | 'finish_only' | 'custom_stage';
  starting_stage?: number;
  starting_stage_notes?: string;
}

export interface SizeMatrixData {
  preset: 'mens_jeans' | 'womens_jeans' | 'mens_tops' | 'womens_tops' | 'custom';
  size_columns: string[];
  fabrics: WeissmadeFabricRow[];
  grand_total: number;
}

export interface WizardDocumentItem {
  id: string;
  file?: File;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  file_path?: string;
  category: string;
  description?: string;
  preview_url?: string;
  is_uploaded?: boolean;
  upload_progress?: number;
}

export interface ApplyWizardState {
  step: number;
  companyInfo: CompanyInfo;
  blanketPo: BlanketPOInfo;
  workOrder: WorkOrderDetails;
  sizeMatrix: SizeMatrixData;
  cutSheetType: SheetType;
  cutSheetData: Partial<ApplyCutSheet>;
  documents: WizardDocumentItem[];
  termsAgreed: boolean;
  accuracyConfirmed: boolean;
  isSubmitting: boolean;
  submissionProgress: number;
  submissionStage: string;
  referenceCode: string | null;
  lastSavedAt: string | null;
}

const DEFAULT_MENS_JEANS_SIZES = ['28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '40'];

export const INITIAL_WIZARD_STATE: ApplyWizardState = {
  step: 1,
  companyInfo: {
    company_name: '',
    brand_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    is_existing_customer: false,
    existing_order_reference: '',
    order_type: 'new_order',
    referral_source: 'Referral',
    website_url_hp: '',
  },
  blanketPo: {
    po_number_preview: 'Assigned upon approval (PO-YYYY-XXXX)',
    contract_quantity: 450,
    contract_duration: '3 months',
    expected_start_date: new Date().toISOString().split('T')[0],
    target_delivery_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  },
  workOrder: {
    style_name: 'WSM-M260 PAUL 5 PKT JEAN',
    style_description: '14oz Classic Straight Leg Raw Selvedge Denim',
    style_number: 'WDLEG-R-DIN',
    colorway: 'INDIGO',
    wash_type: 'Raw / Rigid',
    inseam: '32',
    order_type: 'Bulk',
    priority: 'Normal',
    rush_fee_acknowledged: false,
    rush_note: '',
    service_scope: 'full_cmt',
    starting_stage: 1,
    starting_stage_notes: '',
  },
  sizeMatrix: {
    preset: 'mens_jeans',
    size_columns: DEFAULT_MENS_JEANS_SIZES,
    fabrics: [
      {
        fabric_name: 'SALT',
        color: 'INDIGO',
        size_columns: DEFAULT_MENS_JEANS_SIZES,
        size_matrix: { '28': 15, '29': 25, '30': 40, '31': 35, '32': 50, '33': 30, '34': 40, '36': 20, '38': 10 },
        line_total: 265,
      },
      {
        fabric_name: 'RIVER',
        color: 'DARK WASH',
        size_columns: DEFAULT_MENS_JEANS_SIZES,
        size_matrix: { '29': 20, '30': 30, '31': 25, '32': 45, '33': 25, '34': 30, '36': 10 },
        line_total: 185,
      },
    ],
    grand_total: 450,
  },
  cutSheetType: 'factory_one_production',
  cutSheetData: {
    sheet_name: 'Main Production Cut Ticket',
    sheet_type: 'factory_one_production',
    style_number: 'WDLEG-R-DIN',
    colorway: 'INDIGO',
    cut_number: `CUT-${Date.now().toString().slice(-6)}`,
    cut_date: new Date().toISOString().split('T')[0],
    cutter_name: 'Production Line #1',
    spreader_name: 'Automated Spreader A',
    wash_type: 'Raw / Rigid',
    sheet_data: {
      components: [
        {
          component_name: 'SELF',
          fabric_code: 'RR7276SIOUX45',
          fabric_desc: '14oz Selvedge Denim 100% Cotton',
          lot_number: 'L-9402',
          shade_number: 'S-01',
          roll_number: 'R-108',
          roll_width: '60"',
          number_of_spreads: 4,
          estimated_yield: 1.6,
          damage_percent: 1.5,
          short_percent: 0.5,
          plies: 1.0,
          size_columns: DEFAULT_MENS_JEANS_SIZES,
          size_matrix: { '28': 15, '29': 25, '30': 40, '31': 35, '32': 50, '33': 30, '34': 40, '36': 20, '38': 10 },
          color_lot: 'INDIGO-01',
          total_units: 265,
          ticket_yards: 424,
          yards_used: 424,
          yards_cut: 435,
          yards_damaged: 6.5,
          yards_short: 2.2,
          yards_balance: 2.3,
        },
      ],
      trims: {
        buttons: { type: 'Antique Brass Donut Buttons', qty_per_garment: 5, total_qty: 2250 },
        rivets: { type: 'Copper Burrs', qty_per_garment: 6, total_qty: 2700 },
        zippers: { type: 'YKK #5 Antique Brass Zipper', qty_per_garment: 1, total_qty: 450 },
        thread_outside: 'Tex 105 Golden Tan',
        thread_inside: 'Tex 60 Navy Core',
      },
    },
  },
  documents: [],
  termsAgreed: false,
  accuracyConfirmed: false,
  isSubmitting: false,
  submissionProgress: 0,
  submissionStage: '',
  referenceCode: null,
  lastSavedAt: null,
};

// Helper: isolated draft key based on email hash
export const getDraftStorageKey = (email?: string): string => {
  const safeId = email ? btoa(email.trim().toLowerCase()).replace(/=/g, '').slice(0, 16) : 'anonymous';
  return `forge_apply_draft_${safeId}`;
};

interface ApplyWizardContextType {
  state: ApplyWizardState;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateCompanyInfo: (data: Partial<CompanyInfo>) => void;
  updateBlanketPo: (data: Partial<BlanketPOInfo>) => void;
  updateWorkOrder: (data: Partial<WorkOrderDetails>) => void;
  updateSizeMatrix: (data: Partial<SizeMatrixData>) => void;
  updateCutSheet: (type: SheetType, data: Partial<ApplyCutSheet>) => void;
  addDocument: (doc: WizardDocumentItem) => void;
  updateDocument: (id: string, updates: Partial<WizardDocumentItem>) => void;
  removeDocument: (id: string) => void;
  reorderDocuments: (fromIndex: number, toIndex: number) => void;
  setTermsAgreed: (agreed: boolean) => void;
  setAccuracyConfirmed: (confirmed: boolean) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  setSubmissionProgress: (progress: number, stage: string) => void;
  setReferenceCode: (code: string) => void;
  saveDraftNow: () => void;
  hasSavedDraft: boolean;
  loadSavedDraft: () => boolean;
  clearDraft: () => void;
}

const ApplyWizardContext = createContext<ApplyWizardContextType | undefined>(undefined);

export const ApplyWizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<ApplyWizardState>(() => {
    if (typeof window === 'undefined') return INITIAL_WIZARD_STATE;
    return INITIAL_WIZARD_STATE;
  });

  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync authenticated user credentials into company info only for customer role
  useEffect(() => {
    if (user && user.role === 'customer') {
      setState((prev) => {
        const updated = { ...prev.companyInfo };
        let changed = false;

        if (!updated.company_name && user.customer_name) {
          updated.company_name = user.customer_name;
          changed = true;
        }
        if (!updated.brand_name && user.customer_name) {
          updated.brand_name = user.customer_name;
          changed = true;
        }
        if (!updated.contact_name && (user.full_name || user.email)) {
          updated.contact_name = user.full_name || user.email.split('@')[0];
          changed = true;
        }
        if (!updated.contact_email && user.email) {
          updated.contact_email = user.email;
          changed = true;
        }
        if (!updated.contact_phone && user.contact_phone) {
          updated.contact_phone = user.contact_phone;
          changed = true;
        }
        if (!updated.is_existing_customer) {
          updated.is_existing_customer = true;
          changed = true;
        }

        if (changed) {
          return {
            ...prev,
            companyInfo: updated,
          };
        }
        return prev;
      });
    }
  }, [user]);

  // Check for existing draft on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const anonKey = getDraftStorageKey();
    const raw = localStorage.getItem(anonKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.companyInfo?.company_name || parsed.step > 1)) {
          setHasSavedDraft(true);
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
  }, []);

  // Isolated auto-save every 30 seconds
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      const current = stateRef.current;
      if (!current.companyInfo.company_name && current.step === 1 && !current.documents.length) {
        return; // Don't persist empty initial state
      }
      const key = getDraftStorageKey(current.companyInfo.contact_email);
      const snapshot = {
        ...current,
        // Strip non-serializable File objects
        documents: current.documents.map(d => ({
          ...d,
          file: undefined,
        })),
        lastSavedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(key, JSON.stringify(snapshot));
        setState(prev => ({ ...prev, lastSavedAt: snapshot.lastSavedAt }));
      } catch (err) {
        console.warn('localStorage full or inaccessible:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const saveDraftNow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const current = stateRef.current;
    const key = getDraftStorageKey(current.companyInfo.contact_email);
    const snapshot = {
      ...current,
      documents: current.documents.map(d => ({ ...d, file: undefined })),
      lastSavedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
      setState(prev => ({ ...prev, lastSavedAt: snapshot.lastSavedAt }));
    } catch (err) {
      console.warn('Failed to manually save draft:', err);
    }
  }, []);

  const loadSavedDraft = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const currentEmail = stateRef.current.companyInfo.contact_email;
    const key = getDraftStorageKey(currentEmail);
    const raw = localStorage.getItem(key) || localStorage.getItem(getDraftStorageKey());
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      setState({
        ...INITIAL_WIZARD_STATE,
        ...parsed,
        isSubmitting: false,
        submissionProgress: 0,
      });
      setHasSavedDraft(false);
      return true;
    } catch (e) {
      console.error('Failed to load draft:', e);
      return false;
    }
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    const key = getDraftStorageKey(stateRef.current.companyInfo.contact_email);
    localStorage.removeItem(key);
    localStorage.removeItem(getDraftStorageKey());
    setState(INITIAL_WIZARD_STATE);
    setHasSavedDraft(false);
  }, []);

  const setStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, step: Math.max(1, Math.min(5, step)) }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.min(5, prev.step + 1) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  }, []);

  const updateCompanyInfo = useCallback((data: Partial<CompanyInfo>) => {
    setState(prev => ({ ...prev, companyInfo: { ...prev.companyInfo, ...data } }));
  }, []);

  const updateBlanketPo = useCallback((data: Partial<BlanketPOInfo>) => {
    setState(prev => ({ ...prev, blanketPo: { ...prev.blanketPo, ...data } }));
  }, []);

  const updateWorkOrder = useCallback((data: Partial<WorkOrderDetails>) => {
    setState(prev => ({ ...prev, workOrder: { ...prev.workOrder, ...data } }));
  }, []);

  const updateSizeMatrix = useCallback((data: Partial<SizeMatrixData>) => {
    setState(prev => ({ ...prev, sizeMatrix: { ...prev.sizeMatrix, ...data } }));
  }, []);

  const updateCutSheet = useCallback((type: SheetType, data: Partial<ApplyCutSheet>) => {
    setState(prev => ({
      ...prev,
      cutSheetType: type,
      cutSheetData: { ...prev.cutSheetData, ...data, sheet_type: type },
    }));
  }, []);

  const addDocument = useCallback((doc: WizardDocumentItem) => {
    setState(prev => ({ ...prev, documents: [...prev.documents, doc] }));
  }, []);

  const updateDocument = useCallback((id: string, updates: Partial<WizardDocumentItem>) => {
    setState(prev => ({
      ...prev,
      documents: prev.documents.map(d => (d.id === id ? { ...d, ...updates } : d)),
    }));
  }, []);

  const removeDocument = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== id),
    }));
  }, []);

  const reorderDocuments = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const list = [...prev.documents];
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return { ...prev, documents: list };
    });
  }, []);

  const setTermsAgreed = useCallback((agreed: boolean) => {
    setState(prev => ({ ...prev, termsAgreed: agreed }));
  }, []);

  const setAccuracyConfirmed = useCallback((confirmed: boolean) => {
    setState(prev => ({ ...prev, accuracyConfirmed: confirmed }));
  }, []);

  const setIsSubmitting = useCallback((isSubmitting: boolean) => {
    setState(prev => ({ ...prev, isSubmitting }));
  }, []);

  const setSubmissionProgress = useCallback((progress: number, stage: string) => {
    setState(prev => ({ ...prev, submissionProgress: progress, submissionStage: stage }));
  }, []);

  const setReferenceCode = useCallback((code: string) => {
    setState(prev => ({ ...prev, referenceCode: code }));
  }, []);

  return (
    <ApplyWizardContext.Provider
      value={{
        state,
        setStep,
        nextStep,
        prevStep,
        updateCompanyInfo,
        updateBlanketPo,
        updateWorkOrder,
        updateSizeMatrix,
        updateCutSheet,
        addDocument,
        updateDocument,
        removeDocument,
        reorderDocuments,
        setTermsAgreed,
        setAccuracyConfirmed,
        setIsSubmitting,
        setSubmissionProgress,
        setReferenceCode,
        saveDraftNow,
        hasSavedDraft,
        loadSavedDraft,
        clearDraft,
      }}
    >
      {children}
    </ApplyWizardContext.Provider>
  );
};

export const useApplyWizard = (): ApplyWizardContextType => {
  const context = useContext(ApplyWizardContext);
  if (!context) {
    throw new Error('useApplyWizard must be used within an ApplyWizardProvider');
  }
  return context;
};
