import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { calculateTargetDeliveryDateForContractTerm } from '../lib/utils';
import type {
  ApplyCutSheet,
  SheetType,
  WeissmadeFabricRow
} from '../lib/types';

export interface CompanyInfo {
  company_id?: string;
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
  billing_street?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
  same_as_billing?: boolean;
  shipping_street?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  shipping_country?: string;
  /** Set when the shipping address was selected/edited from an existing address_book row — tells the submit path not to re-insert it as a new address. Absent means it's a genuinely new address to persist. */
  shipping_address_id?: string;
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
  complexity_tier?: 'Simple' | 'Moderate' | 'Complex';
  rush_multiplier?: number;
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

// Sample-Request-only fields not already represented elsewhere in wizard
// state — style_name/description/colorway/fabric_type/custom_fabric_type/
// quantity/size_breakdown deliberately reuse styleBlocks[0] (style_name,
// style_description, colorway, fabric_type, custom_fabric_type, line_total,
// size_matrix) instead of duplicating them here, so Step 3's CutSheetEditor
// and Step 5's ReviewSummary — both already reading styleBlocks — see the
// same data a Bulk order would populate there.
export interface SampleDetails {
  sample_type: 'Fit' | 'Proto' | 'Photo' | 'Pre-Production' | 'Counter';
  fabric_trim_source: 'Factory Sourced' | 'Brand Sourced';
  turnaround_date: string;
  client_reference_sku: string;
  special_instructions?: string;
  tech_pack_url?: string;
  reference_photos?: string[];
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

export type ProductType = 
  | 'Denim/Bottoms'
  | 'Hoodie/Sweatshirt'
  | 'T-Shirt'
  | 'Jacket'
  | 'Shorts'
  | 'Dress'
  | 'Kidswear'
  | 'Custom/Other';

export type FabricType = 'Woven' | 'Knit' | 'Other';

export interface LaundryBatchItem {
  id: string;
  product_name: string;
  quantity: number;
  wash_recipe: string;
  notes?: string;
}

export interface FinishingBatchItem {
  id: string;
  product_name: string;
  quantity: number;
  hangtag_type?: string;
  packaging_spec?: string;
  carton_spec?: string;
  notes?: string;
}

export interface TrimComponent {
  id: string;
  trim_type: 
    | 'Buttons'
    | 'Zippers'
    | 'Rivets & Burrs'
    | 'Drawstrings'
    | 'Ribbing'
    | 'Elastic'
    | 'Embroidery'
    | 'Screen Print'
    | 'Patches'
    | 'Labels / Tags'
    | 'Snaps'
    | 'Velcro'
    | 'Eyelets / Grommets'
    | 'Other';
  specification: string;
  qty_per_garment: number;
  uom: 'pieces' | 'yards' | 'meters' | 'spools' | 'grams' | 'sets' | 'rolls';
}

// REQ-14: per-service detail fields shown when a customer selects that
// service at intake (Section 3C). All optional — customers can submit
// without filling them; the merchandiser fills in the blanks during review.
export interface CuttingServiceDetails {
  fabric_type?: 'Woven' | 'Knit' | 'Other';
  fabric_weight?: string;
  estimated_yardage?: number;
  marker_notes?: string;
  special_instructions?: string;
}

export interface SewingServiceDetails {
  thread_color_specs?: string;
  stitch_type?: 'Single Needle' | 'Double Needle' | 'Chain Stitch' | 'Other';
  label_placement_notes?: string;
}

export interface WashServiceDetails {
  wash_recipe?: 'Enzyme' | 'Stonewash' | 'Bleach' | 'Silicone' | 'Garment Dye' | 'Other';
  target_shade?: string;
  shrinkage_tolerance?: string;
  hand_feel_target?: string;
}

export interface FinishingServiceDetails {
  laser_pattern_ref?: string;
  ozone_level?: string;
  crease_pattern_3d?: string;
  spray_details?: string;
  distressing_level?: 'Light' | 'Medium' | 'Heavy';
}

export interface PackingServiceDetails {
  hangtag_specs?: string;
  care_label_text?: string;
  folding_method?: 'Flat Fold' | 'Hanger';
  poly_bag_required?: boolean;
  carton_specs?: string;
}

export interface ReceivingServiceDetails {
  fabric_roll_count?: number;
  supplier_name?: string;
  expected_delivery_date?: string;
  inspection_level?: 'Standard' | 'Premium';
}

export interface StyleBlockItem {
  id: string;
  product_type: ProductType;
  fabric_type: FabricType;
  custom_fabric_type?: string;
  /** The full pool of custom "Other/Custom" material tags added for this block — see FabricMaterialSelector.tsx. custom_fabric_type holds the comma-joined currently-SELECTED subset of these. */
  custom_fabric_tags?: string[];
  style_name: string;
  style_description?: string;
  style_number: string;
  colorway: string;
  wash_type: string;
  /** Free-text wash type when wash_type === 'Other' — same pattern as WorkOrderDetails.custom_wash_type. */
  custom_wash_type?: string;
  /** True when wash_type was auto-filled from the category-appropriate default (useApplySubmission.ts) because washing was selected but the customer/merchandiser never explicitly chose one — never a customer's real choice. Downstream surfaces (submission inbox, ConversionModal) must flag this distinctly rather than presenting it as an explicit selection. */
  wash_type_is_default?: boolean;
  /** Reference-sheet audit: garment inseam length, mainly relevant for Denim/Bottoms and similar product types. Optional — free text so both numeric ("32") and descriptive ("32in / Regular") values work. */
  inseam?: string;
  /** Reference-sheet audit: per-line note (e.g. "RUSH") distinct from the order-level Rush priority flag. */
  comment?: string;
  /** Reference-sheet audit: which numeric sizing scale this line uses — the reference sheet keys its numeric size scale off this (Mens vs Womens use different scales for the same garment type), which product_type alone doesn't capture. */
  gender_category?: 'Mens' | 'Womens' | 'Unisex' | 'Kids';
  service_scope?: 'full_cmt' | 'cut_make' | 'sew_only' | 'wash_only' | 'finish_only' | 'custom_stage';
  starting_stage?: number;
  /** REQ-14: customer-facing service picks (ServiceScopeSelector) — the source of truth selected_stages is resolved from. */
  selected_services?: string[];
  /** REQ-14: internal stage numbers this style block's selected services resolve to (see resolveSelectedStages in service-scope-constants.ts). */
  selected_stages?: number[];
  /** REQ-14: explicit, deliberate customer statement that they're supplying fully-processed material (no factory-sourced trims) for this block — the only way Material Receiving (stages 1-3) is skipped. Never defaults to true; only offered/relevant when Cutting & Bundling isn't selected. */
  materials_supplied_by_customer?: boolean;
  cutting_details?: CuttingServiceDetails;
  sewing_details?: SewingServiceDetails;
  wash_details?: WashServiceDetails;
  finishing_details?: FinishingServiceDetails;
  packing_details?: PackingServiceDetails;
  receiving_details?: ReceivingServiceDetails;
  size_template_id?: string;
  size_columns: string[];
  size_matrix: Record<string, number>;
  laundry_items?: LaundryBatchItem[];
  finishing_items?: FinishingBatchItem[];
  trims_bom: TrimComponent[];
  line_total: number;
  cut_sheet_data?: Partial<ApplyCutSheet>;
}

export interface ApplyWizardState {
  step: number;
  companyInfo: CompanyInfo;
  blanketPo: BlanketPOInfo;
  workOrder: WorkOrderDetails;
  sizeMatrix: SizeMatrixData;
  styleBlocks: StyleBlockItem[];
  sampleDetails: SampleDetails;
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
  /** Set when this draft was created via "Duplicate This Order" — the source order's order_id, carried through to apply_submissions.duplicated_from_order_id on submit so the lineage is traceable in the submissions inbox and order detail view. Null for an ordinary new application. */
  duplicatedFromOrderId: string | null;
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
    order_type: 'sample_request',
    referral_source: 'Referral',
    website_url_hp: '',
  },
  blanketPo: {
    po_number_preview: 'Assigned upon approval (PO-YYYY-XXXX)',
    contract_quantity: 450,
    contract_duration: '3 months',
    expected_start_date: new Date().toISOString().split('T')[0],
    // Kept in sync with contract_duration above — a 3-month term implies a
    // ~3-month-out delivery target, not an unrelated fixed 45 days.
    target_delivery_date: calculateTargetDeliveryDateForContractTerm('3 months')!,
  },
  workOrder: {
    style_name: 'WSM-M260 PAUL 5 PKT JEAN',
    style_description: '14oz Classic Straight Leg Raw Selvedge Denim',
    style_number: 'WDLEG-R-DIN',
    colorway: 'INDIGO',
    wash_type: '',
    inseam: '32',
    order_type: 'Bulk',
    priority: 'Normal',
    complexity_tier: 'Moderate',
    rush_multiplier: 1.0,
    rush_fee_acknowledged: false,
    rush_note: '',
    service_scope: 'full_cmt',
    starting_stage: 1,
    starting_stage_notes: '',
  },
  sizeMatrix: {
    preset: 'mens_jeans',
    size_columns: DEFAULT_MENS_JEANS_SIZES,
    fabrics: [],
    grand_total: 0,
  },
  styleBlocks: [
    {
      id: 'sb-default-1',
      product_type: 'Denim/Bottoms',
      fabric_type: 'Woven',
      style_name: '',
      style_description: '',
      style_number: '',
      colorway: '',
      wash_type: '',
      service_scope: 'full_cmt',
      starting_stage: 1,
      size_columns: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '40'],
      size_matrix: {},
      line_total: 0,
      trims_bom: [],
    },
  ],
  sampleDetails: {
    sample_type: 'Fit',
    fabric_trim_source: 'Factory Sourced',
    turnaround_date: '',
    client_reference_sku: '',
    special_instructions: '',
    tech_pack_url: '',
    reference_photos: [],
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
    wash_type: '',
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
  duplicatedFromOrderId: null,
};

// Helper: isolated draft key based on email hash
export const getDraftStorageKey = (email?: string): string => {
  const safeId = email ? btoa(email.trim().toLowerCase()).replace(/=/g, '').slice(0, 16) : 'anonymous';
  return `forge_apply_draft_${safeId}`;
};

export interface SavedDraftSummary {
  key: string;
  companyName?: string;
  step?: number;
  lastSavedAt?: string;
}

/**
 * Scans forge_apply_draft_* keys in localStorage and returns each real,
 * valid draft found (newest first) — a "real" draft has either a company
 * name or has progressed past step 1. Shared by two kinds of callers: the
 * wizard's own mount-time recovery-modal check (which only needs the single
 * most recent one) and orders.tsx's deliberate "Resume a saved application"
 * dashboard entry point, which lives outside ApplyWizardProvider entirely
 * and has no other way to know a draft exists. One scan implementation, not
 * two independently-maintained copies of the same logic.
 *
 * `ownerEmail`, when given, restricts the scan to that exact account's own
 * draft slot (getDraftStorageKey(ownerEmail)) instead of every key in the
 * browser. This matters: localStorage is shared across the whole browser,
 * not per logged-in account, so an unfiltered scan can surface a DIFFERENT
 * customer's saved application (company name, step, styles) to whoever is
 * currently logged in on that same browser — a real cross-tenant leak, not
 * a cosmetic one. Every customer-facing caller (the wizard's own
 * DraftRecoveryModal trigger for role==='customer', orders.tsx) must pass
 * the logged-in customer's own email. Leave it omitted only for a context
 * with no single owner to scope to — staff-facing internal intake, where a
 * draft is keyed by the CUSTOMER being served rather than the staff
 * member's own email, and staff already have legitimate visibility into
 * every customer's submissions elsewhere.
 */
export function scanSavedDrafts(ownerEmail?: string): SavedDraftSummary[] {
  if (typeof window === 'undefined') return [];
  const prefix = 'forge_apply_draft_';
  const found: SavedDraftSummary[] = [];
  const allowedKey = ownerEmail ? getDraftStorageKey(ownerEmail) : null;

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    if (allowedKey && k !== allowedKey) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || !(parsed.companyInfo?.company_name || parsed.step > 1)) continue;
      found.push({
        key: k,
        companyName: parsed.companyInfo?.company_name,
        step: parsed.step,
        lastSavedAt: parsed.lastSavedAt,
      });
    } catch (e) {
      // Skip a corrupt/unparseable entry rather than letting it block
      // detection of a real, valid draft under a different key.
    }
  }

  return found.sort((a, b) => {
    const ta = a.lastSavedAt ? new Date(a.lastSavedAt).getTime() : 0;
    const tb = b.lastSavedAt ? new Date(b.lastSavedAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Duplicate Order (orders.$orderId.tsx): seeds the SAME localStorage draft
 * slot saveDraftNow/loadSavedDraft already read and write
 * (getDraftStorageKey) with a new, unsubmitted state built from an existing
 * order's full technical specification — no second, parallel persistence
 * path. Once written, the normal /apply/new or /apply-intake mount-time scan
 * (scanSavedDrafts, above) and DraftRecoveryModal pick it up exactly like
 * any other saved draft; Resume lands on step 3 (the style block editor)
 * with every field intact and still editable.
 *
 * Refuses to silently clobber a real, already-in-progress draft sitting in
 * that same slot — `confirmOverwrite` is called to ask first, and nothing is
 * written if it returns false.
 */
export function seedDraftFromDuplicate(
  partial: {
    companyInfo?: Partial<CompanyInfo>;
    workOrder?: Partial<WorkOrderDetails>;
    styleBlocks: StyleBlockItem[];
    duplicatedFromOrderId: string;
  },
  email: string | undefined,
  confirmOverwrite: () => boolean
): boolean {
  if (typeof window === 'undefined') return false;
  const key = getDraftStorageKey(email);
  const existingRaw = localStorage.getItem(key);
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      const hasRealProgress = existing?.companyInfo?.company_name || (existing?.step || 1) > 1;
      if (hasRealProgress && !confirmOverwrite()) return false;
    } catch (e) {
      // Corrupt existing entry — safe to overwrite without asking.
    }
  }

  const seeded: ApplyWizardState = {
    ...INITIAL_WIZARD_STATE,
    step: 3,
    companyInfo: { ...INITIAL_WIZARD_STATE.companyInfo, ...partial.companyInfo },
    workOrder: { ...INITIAL_WIZARD_STATE.workOrder, ...partial.workOrder },
    styleBlocks: partial.styleBlocks,
    duplicatedFromOrderId: partial.duplicatedFromOrderId,
    lastSavedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(seeded));
    return true;
  } catch (e) {
    console.warn('Failed to seed duplicate-order draft:', e);
    return false;
  }
}

interface ApplyWizardContextType {
  state: ApplyWizardState;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateCompanyInfo: (data: Partial<CompanyInfo> | ((prev: CompanyInfo) => Partial<CompanyInfo>)) => void;
  updateBlanketPo: (data: Partial<BlanketPOInfo>) => void;
  updateWorkOrder: (data: Partial<WorkOrderDetails>) => void;
  updateSizeMatrix: (data: Partial<SizeMatrixData>) => void;
  updateSampleDetails: (data: Partial<SampleDetails>) => void;
  addStyleBlock: (blockData?: Partial<StyleBlockItem>) => void;
  updateStyleBlock: (id: string, updates: Partial<StyleBlockItem>) => void;
  removeStyleBlock: (id: string) => void;
  duplicateStyleBlock: (id: string) => void;
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
  /** Real metadata (company name, step, last-saved time) from the discovered draft itself — not live wizard state, which is still empty until Resume is clicked. */
  savedDraftInfo: { companyName?: string; step?: number; lastSavedAt?: string } | null;
  /** True when the wizard has real content changes since the last save (auto, step-transition, or manual). Drives the exit-navigation warning — never warns when there's genuinely nothing at risk. */
  hasUnsavedChanges: boolean;
  loadSavedDraft: () => boolean;
  clearDraft: () => void;
}

const ApplyWizardContext = createContext<ApplyWizardContextType | undefined>(undefined);

export const ApplyWizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<ApplyWizardState>(() => {
    if (typeof window === 'undefined') return INITIAL_WIZARD_STATE;
    return INITIAL_WIZARD_STATE;
  });

  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  // Real metadata from the DISCOVERED draft itself (company name, step,
  // last-saved time) — never live wizard `state`, which is still the empty
  // INITIAL_WIZARD_STATE until the user actually clicks Resume. Previously
  // the modal read straight from `state`, so it could never show the real
  // saved values.
  const [savedDraftInfo, setSavedDraftInfo] = useState<{ companyName?: string; step?: number; lastSavedAt?: string } | null>(null);
  // The exact localStorage key the mount-time scan found — Resume/Discard
  // must act on this same key, not re-derive one from (still-empty) current
  // state, or they'd silently miss the draft entirely.
  const discoveredDraftKeyRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Unsaved-changes tracking for the exit-warning (item 2). A snapshot-diff
  // approach rather than flagging dirty inside every individual updater —
  // one place to maintain instead of two dozen. lastSavedAt/isSubmitting/
  // submissionProgress/submissionStage/referenceCode are excluded from the
  // compared snapshot: they're bookkeeping, not user content, and
  // lastSavedAt in particular changes on every save, which would make the
  // snapshot never match itself right after saving.
  const lastSavedSnapshotRef = useRef<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const snapshotForDirtyCheck = useCallback((s: ApplyWizardState): string => {
    const { lastSavedAt, isSubmitting, submissionProgress, submissionStage, referenceCode, ...rest } = s;
    return JSON.stringify({
      ...rest,
      documents: rest.documents.map((d) => ({ ...d, file: undefined })),
    });
  }, []);
  useEffect(() => {
    setHasUnsavedChanges(snapshotForDirtyCheck(state) !== lastSavedSnapshotRef.current);
  }, [state, snapshotForDirtyCheck]);

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

  // Check for existing draft on mount (and again once auth resolves / the
  // logged-in identity changes) — scans forge_apply_draft_ keys and picks
  // the most recently saved. Saves are written under an email-specific key
  // the moment an email exists (getDraftStorageKey(contact_email)); a
  // logged-in customer's own draft is always found this way regardless of
  // exactly when it was last saved.
  //
  // Scoped to the current customer's own email once we know who's logged
  // in — an unscoped scan would let this DraftRecoveryModal trigger offer
  // to resume a DIFFERENT customer's saved application left behind in this
  // same browser's localStorage by an earlier session, a real cross-tenant
  // leak. Deliberately left unscoped (scan-all) while auth is still
  // resolving is avoided by waiting for authLoading to clear first, and
  // left unscoped for staff/anonymous sessions, where there's no single
  // customer identity to key the search to (a staff-run intake draft is
  // keyed by the CUSTOMER being served, not the staff member).
  useEffect(() => {
    if (authLoading) return;
    const filterEmail = user?.role === 'customer' ? user.email : undefined;
    const [best] = scanSavedDrafts(filterEmail);
    if (best) {
      discoveredDraftKeyRef.current = best.key;
      setSavedDraftInfo({ companyName: best.companyName, step: best.step, lastSavedAt: best.lastSavedAt });
      setHasSavedDraft(true);
    } else {
      discoveredDraftKeyRef.current = null;
      setSavedDraftInfo(null);
      setHasSavedDraft(false);
    }
  }, [authLoading, user?.role, user?.email]);

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
        lastSavedSnapshotRef.current = snapshotForDirtyCheck(snapshot as unknown as ApplyWizardState);
      } catch (err) {
        console.warn('localStorage full or inaccessible:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const saveDraftNow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const current = stateRef.current;
    // Same empty-state guard the interval save already had — keeps a
    // step-transition/visibility-triggered save from writing a stray,
    // essentially-empty draft entry the moment the wizard mounts.
    if (!current.companyInfo.company_name && current.step === 1 && !current.documents.length) {
      return;
    }
    const key = getDraftStorageKey(current.companyInfo.contact_email);
    const snapshot = {
      ...current,
      documents: current.documents.map(d => ({ ...d, file: undefined })),
      lastSavedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
      setState(prev => ({ ...prev, lastSavedAt: snapshot.lastSavedAt }));
      lastSavedSnapshotRef.current = snapshotForDirtyCheck(snapshot as unknown as ApplyWizardState);
    } catch (err) {
      console.warn('Failed to manually save draft:', err);
    }
  }, [snapshotForDirtyCheck]);

  const loadSavedDraft = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    // Prefer the exact key the mount-time scan discovered — the same key
    // hasSavedDraft/savedDraftInfo were derived from, so Resume always
    // loads exactly what the modal displayed. Falls back to the old
    // current-email/anonymous-key lookup for any caller that runs before
    // (or without) that scan having found anything.
    const discoveredKey = discoveredDraftKeyRef.current;
    const currentEmail = stateRef.current.companyInfo.contact_email;
    const key = getDraftStorageKey(currentEmail);
    const raw = (discoveredKey && localStorage.getItem(discoveredKey))
      || localStorage.getItem(key)
      || localStorage.getItem(getDraftStorageKey());
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const loadedState = {
        ...INITIAL_WIZARD_STATE,
        ...parsed,
        isSubmitting: false,
        submissionProgress: 0,
      };
      setState(loadedState);
      // The freshly-loaded draft is, by definition, in sync with what's
      // stored — not a new unsaved change.
      lastSavedSnapshotRef.current = snapshotForDirtyCheck(loadedState);
      setHasSavedDraft(false);
      setSavedDraftInfo(null);
      discoveredDraftKeyRef.current = null;
      return true;
    } catch (e) {
      console.error('Failed to load draft:', e);
      return false;
    }
  }, [snapshotForDirtyCheck]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    const discoveredKey = discoveredDraftKeyRef.current;
    if (discoveredKey) {
      localStorage.removeItem(discoveredKey);
    }
    const key = getDraftStorageKey(stateRef.current.companyInfo.contact_email);
    localStorage.removeItem(key);
    localStorage.removeItem(getDraftStorageKey());
    setState(INITIAL_WIZARD_STATE);
    lastSavedSnapshotRef.current = snapshotForDirtyCheck(INITIAL_WIZARD_STATE);
    setHasSavedDraft(false);
    setSavedDraftInfo(null);
    discoveredDraftKeyRef.current = null;
  }, [snapshotForDirtyCheck]);

  const setStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, step: Math.max(1, Math.min(5, step)) }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.min(5, prev.step + 1) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  }, []);

  // Save on every step transition (setStep/nextStep/prevStep all funnel
  // through state.step), not just the 30-second interval — a customer who
  // makes progress and closes the tab within that window previously lost
  // it. Runs after the step commits (not inside the setState updater
  // itself) so it always saves the real, new step number. saveDraftNow's
  // own empty-state guard makes the very first mount-time firing harmless.
  const isFirstStepEffect = useRef(true);
  useEffect(() => {
    if (isFirstStepEffect.current) {
      isFirstStepEffect.current = false;
      return;
    }
    saveDraftNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // Save on tab close / backgrounding, not only the periodic interval.
  // visibilitychange (fires on 'hidden') is the reliable, current
  // best-practice signal — beforeunload is kept alongside it as a
  // desktop-tab-close backstop, but never used to show the browser's "leave
  // site?" confirmation (no preventDefault/returnValue set) — this is a
  // silent background save, not an interruption.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveDraftNow();
    };
    const handleBeforeUnload = () => {
      saveDraftNow();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Accepts a functional updater (reads prev.companyInfo, returns the
  // partial patch) as well as a plain partial object — lets callers whose
  // own callback reference must stay stable across renders (e.g.
  // CustomerSelector's onCustomerSelect, read by a useEffect dependency
  // array in CustomerSelector.tsx — an unstable reference there re-fires
  // that effect on every render, an infinite loop) avoid closing over
  // companyInfo at all.
  const updateCompanyInfo = useCallback((data: Partial<CompanyInfo> | ((prev: CompanyInfo) => Partial<CompanyInfo>)) => {
    setState(prev => ({
      ...prev,
      companyInfo: { ...prev.companyInfo, ...(typeof data === 'function' ? data(prev.companyInfo) : data) },
    }));
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

  const updateSampleDetails = useCallback((data: Partial<SampleDetails>) => {
    setState(prev => ({ ...prev, sampleDetails: { ...prev.sampleDetails, ...data } }));
  }, []);

  const addStyleBlock = useCallback((blockData?: Partial<StyleBlockItem>) => {
    setState((prev) => {
      const newBlock: StyleBlockItem = {
        id: `sb-${Date.now()}`,
        product_type: blockData?.product_type || 'Denim/Bottoms',
        fabric_type: blockData?.fabric_type || 'Woven',
        style_name: blockData?.style_name || '',
        style_number: blockData?.style_number || '',
        colorway: blockData?.colorway || '',
        wash_type: blockData?.wash_type || '',
        service_scope: blockData?.service_scope || 'full_cmt',
        starting_stage: blockData?.starting_stage || 1,
        size_columns: blockData?.size_columns || ['28', '29', '30', '31', '32', '33', '34', '35', '36', '38', '40'],
        size_matrix: blockData?.size_matrix || {},
        trims_bom: blockData?.trims_bom || [],
        line_total: 0,
        ...blockData,
      };
      return {
        ...prev,
        styleBlocks: [...prev.styleBlocks, newBlock],
      };
    });
  }, []);

  const updateStyleBlock = useCallback((id: string, updates: Partial<StyleBlockItem>) => {
    setState((prev) => ({
      ...prev,
      styleBlocks: prev.styleBlocks.map((sb) => (sb.id === id ? { ...sb, ...updates } : sb)),
    }));
  }, []);

  const removeStyleBlock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      styleBlocks: prev.styleBlocks.filter((sb) => sb.id !== id),
    }));
  }, []);

  const duplicateStyleBlock = useCallback((id: string) => {
    setState((prev) => {
      const existing = prev.styleBlocks.find((sb) => sb.id === id);
      if (!existing) return prev;
      const dup: StyleBlockItem = {
        ...existing,
        id: `sb-${Date.now()}`,
        style_number: `${existing.style_number}-COPY`,
        style_name: `${existing.style_name} (Copy)`,
      };
      return {
        ...prev,
        styleBlocks: [...prev.styleBlocks, dup],
      };
    });
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
        updateSampleDetails,
        addStyleBlock,
        updateStyleBlock,
        removeStyleBlock,
        duplicateStyleBlock,
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
        savedDraftInfo,
        hasUnsavedChanges,
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
