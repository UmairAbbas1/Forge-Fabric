// FORGE & FABRIC INDUSTRIES, INC. — COMPLETE TYPE DEFINITIONS & SCHEMAS

export type RoleType = 'admin' | 'merchandiser' | 'production' | 'qc' | 'customer';

export type SubmissionStatus =
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_info'
  | 'converted';

export type SubmissionType = 'new_order' | 'update_request' | 'sample_request';
export type SubmissionSource = 'apply_portal' | 'merchandiser_intake' | 'email';

export type SheetType =
  | 'factory_one_production'
  | 'weissmade_size_matrix'
  | 'same_sample_request'
  | 'custom';

export type UpdateRequestType =
  | 'cut_sheet_update'
  | 'size_matrix_change'
  | 'style_change'
  | 'wash_change'
  | 'qty_increase'
  | 'qty_decrease'
  | 'cancel_order'
  | 'rush_request'
  | 'document_update'
  | 'delivery_change'
  | 'other';

export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export type UpdateRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'closed';

export type GateName = 'planned' | 'cutting' | 'sewing' | 'final_qc' | 'packing';

export type SizeMatrix = Record<string, number>;

export type FacilityType = 'Sewing Facility' | 'Laundry Facility' | 'Sewing' | 'Laundry';

// ----------------------------------------------------------------------------
// Apply Portal Core Interfaces
// ----------------------------------------------------------------------------

export interface ApplySubmission {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  brand_name?: string;
  website?: string;
  status: SubmissionStatus;
  assigned_merchandiser_id?: string;
  submission_type: SubmissionType;
  source: SubmissionSource;
  internal_notes?: string;
  client_notes?: string;
  submitted_at: string;
  reviewed_at?: string;
  converted_to_po_id?: string;
  apply_reference_code?: string;
  product_type?: string;
  fabric_type?: string;
  style_blocks?: any[];
  trim_components?: any[];
  existing_order_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface CutSheetComponent {
  component_name: 'SELF' | 'FUSE' | 'LINING' | string;
  fabric_code: string;
  fabric_desc?: string;
  lot_number?: string;
  shade_number?: string;
  roll_number?: string;
  roll_width?: string;
  roll_width_units?: string;
  number_of_spreads?: number;
  estimated_yield: number;
  actual_yield?: number;
  damage_percent?: number;
  short_percent?: number;
  plies: number;
  size_columns: string[];
  size_matrix: SizeMatrix;
  color_lot?: string;
  total_units: number;
  ticket_yards?: number;
  yards_used?: number;
  yards_cut?: number;
  yards_damaged?: number;
  yards_short?: number;
  yards_balance?: number;
}

export interface WeissmadeFabricRow {
  fabric_name: string;
  color: string;
  size_columns: string[];
  size_matrix: SizeMatrix;
  line_total: number;
}

export interface CutSheetTrims {
  buttons?: { type: string; qty_per_garment: number; total_qty: number };
  rivets?: { type: string; qty_per_garment: number; total_qty: number };
  zippers?: { type: string; qty_per_garment: number; total_qty: number };
  patches?: { type: string; qty_per_garment: number; total_qty: number };
  thread_outside?: string;
  thread_inside?: string;
  labels?: string[];
}

export interface CutSheetPacking {
  carton_count?: number;
  units_per_carton?: number;
  polybag_specs?: string;
  hanger_specs?: string;
  upc_labels_attached?: boolean;
  box_marking?: string;
}

export interface CutSheetData {
  components?: CutSheetComponent[];
  trims?: CutSheetTrims;
  packing?: CutSheetPacking;
  fabrics?: WeissmadeFabricRow[];
  grand_total?: number;
  style_name?: string;
  sample_po_number?: string;
  comments?: string;
  spec_inst_sendout?: string[];
  sz_cut_numbers?: string[];
  marker_numbers?: string[];
  marker_dates?: string[];
  wash_type?: string;
  fabric_details?: {
    lot_number?: string;
    shade?: string;
    roll_number?: string;
    shrinkage?: string;
  };
}

export type CutSheetApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'revised';

export interface CutSheetComment {
  id: string;
  cell_key: string;
  author: string;
  author_id?: string;
  text: string;
  created_at: string;
}

export interface CutSheetFormatting {
  highlighted_cells?: Record<string, 'yellow' | 'green' | 'red'>;
  formulas?: Record<string, string>;
  frozen_panes?: boolean;
}

export interface CutSheetVersionRecord {
  id: string;
  cut_sheet_id: string;
  version: number;
  change_summary: string;
  created_by: string;
  created_at: string;
  snapshot: CutSheetData;
  approval_status: CutSheetApprovalStatus;
}

export interface CutSheetSemanticDiffItem {
  type: 'size_qty' | 'component' | 'fabric' | 'yield' | 'trims' | 'meta';
  label: string;
  old_value: string | number;
  new_value: string | number;
  delta?: number;
}

export interface ApplyCutSheet {
  id: string;
  submission_id: string;
  work_order_id?: string;
  sheet_type: SheetType;
  sheet_name?: string;
  style_number?: string;
  cut_number?: string;
  colorway?: string;
  wash_type?: string;
  cut_for?: string;
  ship_to?: string;
  style_no: string;
  style_description?: string;
  cut_no?: string;
  cut_date?: string;
  data_clerk?: string;
  cutter_name?: string;
  spreader_name?: string;
  sewer_name?: string;
  wash_dx_cd?: string;
  laundry_self?: 'Laundry' | 'Self';
  sheet_data: CutSheetData;
  original_excel_url?: string;
  version: number;
  is_current: boolean;
  approval_status?: CutSheetApprovalStatus;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  comments?: CutSheetComment[];
  formatting?: CutSheetFormatting;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SubmissionPayload {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  brand_name?: string;
  website?: string;
  submission_type: 'new_order' | 'sample_request' | 'blanket_po' | 'wash_development';
  client_notes?: string;
  cut_sheets?: any[];
  documents?: any[];
  product_type?: string;
  fabric_type?: string;
  style_blocks?: any[];
  trim_components?: any[];
  /** REQ-14: union of every style block's resolved selected_stages — the internal stage numbers this submission actually requested. */
  requested_stages?: number[];
}

export interface UpdateRequestPayload {
  blanket_po_id?: string;
  work_order_id?: string;
  apply_submission_id?: string;
  submission_id?: string;
  apply_reference_code?: string;
  po_number?: string;
  requested_by_name?: string;
  requested_by_email?: string;
  request_type?: string;
  priority?: string;
  subject?: string;
  description?: string;
  requested_changes?: string;
  contact_email?: string;
  contact_name?: string;
  attached_files?: any[];
}

// ----------------------------------------------------------------------------
// Stage Jump & Multi-Facility Logistics Interfaces
// ----------------------------------------------------------------------------

export interface StageJumpLog {
  id: string;
  work_order_id: string;
  from_stage_id: number;
  to_stage_id: number;
  jumped_by?: string;
  jumped_by_name?: string;
  jumped_by_role?: RoleType;
  jump_reason?: string;
  validation_passed: boolean;
  validation_error?: string;
  created_at: string;
}

export type Facility = 'Sewing Facility' | 'Laundry Facility';

export type MaterialCategory =
  | 'Fabric'
  | 'Trim'
  | 'Thread'
  | 'Button'
  | 'Rivet'
  | 'Zipper'
  | 'Pocketing'
  | 'Patch'
  | 'Label'
  | 'Chemical'
  | 'Packaging'
  | 'Other';

export type MaterialUnit =
  | 'Yards'
  | 'Meters'
  | 'Rolls'
  | 'Pieces'
  | 'Kg'
  | 'Lbs'
  | 'Dozens'
  | 'Cards'
  | 'Bags'
  | 'Liters'
  | 'Boxes'
  | 'Cones';

export type MaterialStatus =
  | 'Expected'
  | 'In Transit'
  | 'Received'
  | 'In QC'
  | 'Approved'
  | 'Rejected'
  | 'Partial';

export interface RawMaterialsIntake {
  id: string;
  intake_number: string;
  facility: Facility;
  work_order_id?: string;
  blanket_po_id?: string;
  order_id?: string;
  po_number?: string;
  item_name: string;
  category: MaterialCategory;
  supplier?: string;
  supplier_po?: string;
  quantity_expected: number;
  quantity_received: number;
  quantity_damaged: number;
  quantity_accepted?: number;
  unit: MaterialUnit;
  lot_number?: string;
  shade_lot?: string;
  storage_location?: string;
  status: MaterialStatus;
  received_date: string;
  expected_date?: string;
  inspected_by?: string;
  inspected_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface UpdateRequest {
  id: string;
  blanket_po_id?: string;
  work_order_id?: string;
  requested_by_customer_id?: string;
  requested_by_email: string;
  request_type: UpdateRequestType | string;
  request_subject: string;
  request_description: string;
  priority: RequestPriority;
  status: UpdateRequestStatus | string;
  attachment_urls?: string[];
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  new_cut_sheet_id?: string;
  email_sent_to_merchandiser?: boolean;
  email_sent_to_client?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplyDocument {
  id: string;
  submission_id: string;
  doc_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes?: number;
  mime_type?: string;
  description?: string;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface MerchandiserAssignment {
  id: string;
  merchandiser_id: string;
  submission_id: string;
  assigned_at: string;
  assigned_by?: string;
  notes?: string;
  is_active: boolean;
}

export interface NotificationLog {
  id: string;
  recipient_id?: string;
  recipient_email: string;
  notification_type: string;
  subject: string;
  body?: string;
  related_submission_id?: string;
  related_update_request_id?: string;
  sent_at: string;
  delivered: boolean;
  opened: boolean;
}

// ----------------------------------------------------------------------------
// Production & Gate Tracking Interfaces (Fixes #1, #2, #3, #4, #18)
// ----------------------------------------------------------------------------

export interface BlanketPO {
  id: string;
  po_number: string;
  customer_id?: string;
  customer_type: 'External' | 'Internal_Brand';
  total_contract_qty: number;
  fulfilled_qty: number;
  remaining_balance: number;
  po_type: 'Blanket' | 'Standard';
  expiration_date?: string;
  source_submission_id?: string;
  apply_reference_code?: string;
  client_submitted: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  blanket_po_id?: string;
  wo_number: string;
  order_type: 'Bulk' | 'Sample' | 'Rush';
  priority: 'Normal' | 'Rush';
  style_name: string;
  colorway: string;
  wash_process_type: string;
  target_qty: number;
  size_breakdown: SizeMatrix;
  current_stage_id: number;
  status: string;
  due_date?: string;
  source_cut_sheet_id?: string;
  apply_reference_code?: string;
  created_at: string;
  updated_at: string;
}

export interface SizeGateRecord {
  id: string;
  work_order_id: string;
  gate_name: GateName;
  size_breakdown: SizeMatrix;
  yield_data?: Record<string, any>;
  recorded_by?: string;
  recorded_at: string;
}

export interface Bundle {
  id: string;
  work_order_id: string;
  bundle_barcode: string;
  cut_number?: string;
  size: string;
  quantity: number;
  colorway?: string;
  fabric_lot_no?: string;
  current_stage_id: number;
  status: 'active' | 'completed' | 'hold' | 'rejected';
  qr_code_svg?: string;
  created_at: string;
}

export interface BundleQRPayload {
  bundle_id: string;
  wo_number: string;
  cut_number?: string;
  size: string;
  quantity: number;
  barcode: string;
}

export interface ScanEvent {
  id: string;
  bundle_id: string;
  stage_id: number;
  operator_id?: string;
  machine_id?: string;
  scanned_at: string;
  status: 'passed' | 'flagged' | 'exception';
  exception_reason?: string;
  reconciled: boolean;
}

export interface QCDefectLog {
  id: string;
  work_order_id: string;
  stage_id: number;
  bundle_id?: string;
  garment_serial_or_rfid?: string;
  defect_category: string;
  defect_type: string;
  photo_url?: string;
  operator_id?: string;
  operator_name?: string;
  machine_id?: string;
  shift_id?: string;
  supervisor_id?: string;
  fabric_lot_no?: string;
  wash_batch_id?: string;
  root_cause_summary?: string;
  corrective_action?: string;
  logged_by?: string;
  logged_at: string;
}

export interface InventoryItem {
  id: string;
  item_code: string;
  item_name: string;
  category: 'Fabric' | 'Trim' | 'Accessory' | 'Packaging' | 'Chemical' | string;
  facility: FacilityType;
  storage_location?: string;
  unit_of_measure: 'Yards' | 'Pieces' | 'Gross' | 'Rolls' | 'Kg' | string;
  quantity_on_hand: number;
  allocated_quantity: number;
  available_quantity: number;
  reorder_threshold: number;
  lead_time_days: number;
  supplier_name?: string;
  fabric_lot_or_dye_lot?: string;
  last_inspected_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderDocument {
  id: string;
  work_order_id?: string;
  doc_type: 'CutSheet' | 'TechPack' | 'CuttingTicket' | 'POD' | 'Photo' | string;
  file_name: string;
  file_url: string;
  version: string;
  is_current: boolean;
  is_customer_visible: boolean;
  uploaded_by?: string;
  created_at: string;
}

export interface DeliveryManifest {
  id: string;
  manifest_number: string;
  work_order_id: string;
  destination_hub: string;
  size_manifest: SizeMatrix;
  total_pieces: number;
  driver_name: string;
  driver_signature_png: string;
  dock_camera_timestamp?: string;
  liability_clause_accepted: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Merchandiser Intake & Conversion Types (Prompt #3 Master)
// ----------------------------------------------------------------------------

export interface MerchandiserIntakeData {
  client_id?: string;
  is_new_client?: boolean;
  new_client_name?: string;
  new_client_email?: string;
  new_client_phone?: string;
  internal_priority: 'Normal' | 'High' | 'Urgent';
  margin_notes?: string;
  production_floor_notes?: string;
  assigned_cutter_id?: string;
  assigned_sewing_line?: string;
  expected_wash_batch?: string;
  skip_cut_sheet?: boolean;
}

export interface ClientAccountCreationPayload {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  send_magic_link?: boolean;
}

export interface ConversionModalMapping {
  submission_id: string;
  company_name: string;
  contact_email: string;
  customer_id?: string;
  is_new_customer?: boolean;
  po_number: string;
  contract_quantity: number;
  wo_number: string;
  style_name: string;
  colorway: string;
  wash_process_type: string;
  due_date: string;
  order_type: 'Bulk' | 'Sample' | 'Rush';
  priority: 'Normal' | 'Rush';
  size_breakdown: SizeMatrix;
  gate_1_planned_sizes: SizeMatrix;
  link_documents: boolean;
  link_cut_sheet: boolean;
  starting_stage?: number;
  service_scope?: string;
  /** REQ-14: resolved internal stage numbers for this order's selective pipeline (Section 3E). */
  selected_stages?: number[];
}

// ----------------------------------------------------------------------------
// Master Prompt #4 Types: Stage Navigator & Raw Materials Intake
// ----------------------------------------------------------------------------

export interface StageDefinition {
  id: number;
  name: string;
  icon: string;
  input?: string;
  output?: string;
  equipment?: string;
}

