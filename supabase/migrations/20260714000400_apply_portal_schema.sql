-- ============================================================================
-- FORGE & FABRIC — APPLY PORTAL & ADVANCED PRODUCTION SCHEMA MIGRATION
-- Migration: 20260714000400_apply_portal_schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCES & HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Reference code sequence for client applications (APP-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS public.apply_ref_seq START 1;

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate reference code on apply_submissions insert
CREATE OR REPLACE FUNCTION public.generate_apply_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.apply_reference_code IS NULL OR NEW.apply_reference_code = '' THEN
        NEW.apply_reference_code = 'APP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.apply_ref_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. EXTEND EXISTING PROFILES TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_portal_user BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS facility VARCHAR(30) DEFAULT 'Sewing';

-- ----------------------------------------------------------------------------
-- 3. CORE ENTERPRISE ORDER TABLES (blanket_pos & work_orders)
-- ----------------------------------------------------------------------------

-- Blanket Purchase Orders (Parent Contract)
CREATE TABLE IF NOT EXISTS public.blanket_pos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_type VARCHAR(20) DEFAULT 'External', -- 'External' | 'Internal_Brand'
    total_contract_qty INT NOT NULL,
    fulfilled_qty INT DEFAULT 0,
    remaining_balance INT GENERATED ALWAYS AS (total_contract_qty - fulfilled_qty) STORED,
    po_type VARCHAR(20) DEFAULT 'Blanket', -- 'Blanket' | 'Standard'
    expiration_date DATE,
    apply_reference_code VARCHAR(50),
    client_submitted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Orders (Child Process-Variant WOs)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blanket_po_id UUID REFERENCES public.blanket_pos(id) ON DELETE CASCADE,
    wo_number VARCHAR(50) UNIQUE NOT NULL,
    order_type VARCHAR(20) DEFAULT 'Bulk', -- 'Bulk' | 'Sample' | 'Rush'
    priority VARCHAR(10) DEFAULT 'Normal', -- 'Normal' | 'Rush'
    style_name VARCHAR(100) NOT NULL,
    colorway VARCHAR(50) NOT NULL,
    wash_process_type VARCHAR(100) NOT NULL,
    target_qty INT NOT NULL,
    size_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"28": 10, "30": 25, "32": 25, "34": 15}
    current_stage_id INT DEFAULT 1,
    status VARCHAR(30) DEFAULT 'Open',
    due_date DATE,
    apply_reference_code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. APPLY PORTAL INTAKE TABLES
-- ----------------------------------------------------------------------------

-- Raw Client Applications
CREATE TABLE IF NOT EXISTS public.apply_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Contact & Company Info
    company_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(50),
    brand_name VARCHAR(150),
    website VARCHAR(255),

    -- Status Workflow
    status VARCHAR(30) DEFAULT 'pending_review',
        -- 'pending_review' | 'under_review' | 'approved' | 'rejected' | 'needs_info' | 'converted'

    -- Assigned Merchandiser
    assigned_merchandiser_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Metadata
    submission_type VARCHAR(30) DEFAULT 'new_order',
        -- 'new_order' | 'update_request' | 'sample_request'
    source VARCHAR(30) DEFAULT 'apply_portal',
        -- 'apply_portal' | 'merchandiser_intake' | 'email'

    internal_notes TEXT,
    client_notes TEXT,

    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    converted_to_po_id UUID REFERENCES public.blanket_pos(id) ON DELETE SET NULL,
    apply_reference_code VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link blanket_pos back to source_submission_id
ALTER TABLE public.blanket_pos
    ADD COLUMN IF NOT EXISTS source_submission_id UUID REFERENCES public.apply_submissions(id) ON DELETE SET NULL;

-- Cut Sheets (Excel-like cut sheet & size matrix data stored as JSONB)
CREATE TABLE IF NOT EXISTS public.apply_cut_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.apply_submissions(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,

    -- Sheet Template Type
    sheet_type VARCHAR(50) NOT NULL,
        -- 'factory_one_production' | 'weissmade_size_matrix' | 'same_sample_request' | 'custom'

    -- Header Info
    cut_for VARCHAR(150),
    ship_to VARCHAR(150),
    style_no VARCHAR(100) NOT NULL,
    style_description TEXT,
    cut_no VARCHAR(50),
    cut_date DATE,

    -- Production Metadata
    data_clerk VARCHAR(100),
    cutter_name VARCHAR(100),
    spreader_name VARCHAR(100),
    sewer_name VARCHAR(100),

    -- Wash / Process
    wash_dx_cd VARCHAR(100),
    laundry_self VARCHAR(20), -- 'Laundry' | 'Self'

    -- Exact Spreadsheet Structured JSONB Data
    sheet_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    original_excel_url TEXT,
    version INT DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link work_orders back to source_cut_sheet_id
ALTER TABLE public.work_orders
    ADD COLUMN IF NOT EXISTS source_cut_sheet_id UUID REFERENCES public.apply_cut_sheets(id) ON DELETE SET NULL;

-- Client Update & Change Requests
CREATE TABLE IF NOT EXISTS public.update_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    blanket_po_id UUID REFERENCES public.blanket_pos(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,

    requested_by_customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_by_email VARCHAR(150) NOT NULL,

    request_type VARCHAR(50) NOT NULL,
        -- 'cut_sheet_update' | 'size_matrix_change' | 'style_change' | 
        -- 'wash_change' | 'qty_increase' | 'qty_decrease' | 'cancel_order' |
        -- 'rush_request' | 'document_update' | 'delivery_change' | 'other'

    request_subject VARCHAR(255) NOT NULL,
    request_description TEXT NOT NULL,

    priority VARCHAR(20) DEFAULT 'normal',
        -- 'low' | 'normal' | 'high' | 'urgent'

    status VARCHAR(30) DEFAULT 'submitted',
        -- 'submitted' | 'under_review' | 'approved' | 'rejected' | 
        -- 'in_progress' | 'completed' | 'closed'

    attachment_urls TEXT[],
    resolution_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,

    new_cut_sheet_id UUID REFERENCES public.apply_cut_sheets(id) ON DELETE SET NULL,

    email_sent_to_merchandiser BOOLEAN DEFAULT FALSE,
    email_sent_to_client BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake Documents (Tech Packs, Specs, POs, Reference Images)
CREATE TABLE IF NOT EXISTS public.apply_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.apply_submissions(id) ON DELETE CASCADE,

    doc_type VARCHAR(50) NOT NULL,
        -- 'tech_pack' | 'style_sheet' | 'reference_image' | 'fabric_swatches' |
        -- 'trim_specs' | 'wash_instructions' | 'size_spec' | 'brand_guidelines' |
        -- 'previous_sample' | 'purchase_order' | 'cut_sheet_excel' | 'other'

    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INT,
    mime_type VARCHAR(100),

    description TEXT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchandiser Assignments & Intake Routing Audit
CREATE TABLE IF NOT EXISTS public.merchandiser_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchandiser_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    submission_id UUID REFERENCES public.apply_submissions(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Notification & Email Dispatch Log
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_email VARCHAR(150) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
        -- 'submission_received' | 'status_update' | 'update_request' |
        -- 'assignment' | 'approval' | 'rejection' | 'needs_info'
    subject VARCHAR(255) NOT NULL,
    body TEXT,
    related_submission_id UUID REFERENCES public.apply_submissions(id) ON DELETE SET NULL,
    related_update_request_id UUID REFERENCES public.update_requests(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered BOOLEAN DEFAULT FALSE,
    opened BOOLEAN DEFAULT FALSE
);

-- ----------------------------------------------------------------------------
-- 5. PRODUCTION GATE RECORDS, BUNDLES, QC RCA & INVENTORY (Fixes #1, #2, #3, #4)
-- ----------------------------------------------------------------------------

-- 5 Key Production Gates Size Tracking (Fix #1)
CREATE TABLE IF NOT EXISTS public.size_gate_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    gate_name VARCHAR(20) NOT NULL CHECK (
        gate_name IN ('planned', 'cutting', 'sewing', 'final_qc', 'packing')
    ),
    size_breakdown JSONB NOT NULL, -- e.g. {"28": 10, "30": 25, "32": 25, "34": 15}
    yield_data JSONB,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(work_order_id, gate_name)
);

-- QR Code Bundles (Fix #2)
CREATE TABLE IF NOT EXISTS public.bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    bundle_barcode VARCHAR(50) UNIQUE NOT NULL,
    cut_number VARCHAR(50),
    size VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    colorway VARCHAR(50),
    fabric_lot_no VARCHAR(50),
    current_stage_id INT DEFAULT 5,
    status VARCHAR(20) DEFAULT 'active', -- 'active' | 'completed' | 'hold' | 'rejected'
    qr_code_svg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scan-by-Exception Events (Fix #2)
CREATE TABLE IF NOT EXISTS public.scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID REFERENCES public.bundles(id) ON DELETE CASCADE NOT NULL,
    stage_id INT NOT NULL,
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    machine_id VARCHAR(50),
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'passed', -- 'passed' | 'flagged' | 'exception'
    exception_reason TEXT,
    reconciled BOOLEAN DEFAULT FALSE
);

-- QC Defect Logs with RCA Line Tracing (Fix #3)
CREATE TABLE IF NOT EXISTS public.qc_defect_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    stage_id INT NOT NULL,
    bundle_id UUID REFERENCES public.bundles(id) ON DELETE SET NULL,
    garment_serial_or_rfid VARCHAR(100),
    defect_category VARCHAR(50) NOT NULL, -- 'Sewing', 'Fabric', 'Wash', 'Trims', 'Measurement'
    defect_type VARCHAR(100) NOT NULL,
    photo_url TEXT,
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    operator_name VARCHAR(100),
    machine_id VARCHAR(50),
    shift_id VARCHAR(20),
    supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    fabric_lot_no VARCHAR(50),
    wash_batch_id UUID,
    root_cause_summary TEXT,
    corrective_action TEXT,
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dual-Facility Inventory Items (Fix #4)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Fabric', 'Trim', 'Accessory', 'Packaging', 'Chemical'
    facility VARCHAR(50) NOT NULL DEFAULT 'Sewing Facility', -- 'Sewing Facility' | 'Laundry Facility'
    storage_location VARCHAR(100),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'Yards', -- 'Yards', 'Pieces', 'Gross', 'Rolls', 'Kg'
    quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
    allocated_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    available_quantity NUMERIC(10,2) GENERATED ALWAYS AS (quantity_on_hand - allocated_quantity) STORED,
    reorder_threshold NUMERIC(10,2) DEFAULT 0,
    lead_time_days INT DEFAULT 5,
    supplier_name VARCHAR(150),
    fabric_lot_or_dye_lot VARCHAR(100),
    last_inspected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Documents Vault (Revision Controlled)
CREATE TABLE IF NOT EXISTS public.order_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL, -- 'CutSheet', 'TechPack', 'CuttingTicket', 'POD', 'Photo'
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    version VARCHAR(20) DEFAULT 'v1.0',
    is_current BOOLEAN DEFAULT TRUE,
    is_customer_visible BOOLEAN DEFAULT FALSE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Manifests with Driver Signature POD
CREATE TABLE IF NOT EXISTS public.delivery_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_number VARCHAR(50) UNIQUE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    destination_hub VARCHAR(100) NOT NULL,
    size_manifest JSONB NOT NULL, -- Exact piece counts per size
    total_pieces INT NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    driver_license_no VARCHAR(50),
    driver_signature_png TEXT NOT NULL,
    dock_camera_timestamp TIMESTAMPTZ,
    liability_clause_accepted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS
-- ----------------------------------------------------------------------------

-- Apply Reference Code Generator Trigger
DROP TRIGGER IF EXISTS trg_apply_submissions_reference ON public.apply_submissions;
CREATE TRIGGER trg_apply_submissions_reference
    BEFORE INSERT ON public.apply_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_apply_reference();

-- Timestamp Update Triggers
DROP TRIGGER IF EXISTS trg_blanket_pos_updated_at ON public.blanket_pos;
CREATE TRIGGER trg_blanket_pos_updated_at
    BEFORE UPDATE ON public.blanket_pos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_work_orders_updated_at ON public.work_orders;
CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_apply_submissions_updated_at ON public.apply_submissions;
CREATE TRIGGER trg_apply_submissions_updated_at
    BEFORE UPDATE ON public.apply_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_apply_cut_sheets_updated_at ON public.apply_cut_sheets;
CREATE TRIGGER trg_apply_cut_sheets_updated_at
    BEFORE UPDATE ON public.apply_cut_sheets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_requests_updated_at ON public.update_requests;
CREATE TRIGGER trg_update_requests_updated_at
    BEFORE UPDATE ON public.update_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES (Fixes #14, #15)
-- ----------------------------------------------------------------------------

-- apply_submissions
CREATE INDEX IF NOT EXISTS idx_apply_submissions_status ON public.apply_submissions(status);
CREATE INDEX IF NOT EXISTS idx_apply_submissions_email ON public.apply_submissions(contact_email);
CREATE INDEX IF NOT EXISTS idx_apply_submissions_merch ON public.apply_submissions(assigned_merchandiser_id);
CREATE INDEX IF NOT EXISTS idx_apply_submissions_ref ON public.apply_submissions(apply_reference_code);

-- apply_cut_sheets
CREATE INDEX IF NOT EXISTS idx_apply_cut_sheets_submission ON public.apply_cut_sheets(submission_id);
CREATE INDEX IF NOT EXISTS idx_apply_cut_sheets_wo ON public.apply_cut_sheets(work_order_id);
CREATE INDEX IF NOT EXISTS idx_apply_cut_sheets_style ON public.apply_cut_sheets(style_no);

-- update_requests
CREATE INDEX IF NOT EXISTS idx_update_requests_po ON public.update_requests(blanket_po_id);
CREATE INDEX IF NOT EXISTS idx_update_requests_wo ON public.update_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_update_requests_status ON public.update_requests(status);
CREATE INDEX IF NOT EXISTS idx_update_requests_email ON public.update_requests(requested_by_email);

-- apply_documents
CREATE INDEX IF NOT EXISTS idx_apply_docs_submission ON public.apply_documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_apply_docs_type ON public.apply_documents(doc_type);

-- merchandiser_assignments
CREATE INDEX IF NOT EXISTS idx_merch_assign_merch ON public.merchandiser_assignments(merchandiser_id);
CREATE INDEX IF NOT EXISTS idx_merch_assign_sub ON public.merchandiser_assignments(submission_id);

-- blanket_pos & work_orders
CREATE INDEX IF NOT EXISTS idx_blanket_pos_customer ON public.blanket_pos(customer_id);
CREATE INDEX IF NOT EXISTS idx_blanket_pos_number ON public.blanket_pos(po_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_po ON public.work_orders(blanket_po_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_type ON public.work_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON public.work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_stage ON public.work_orders(current_stage_id);

-- size_gate_records
CREATE INDEX IF NOT EXISTS idx_size_gates_wo ON public.size_gate_records(work_order_id);
CREATE INDEX IF NOT EXISTS idx_size_gates_name ON public.size_gate_records(gate_name);

-- bundles & scan_events
CREATE INDEX IF NOT EXISTS idx_bundles_wo ON public.bundles(work_order_id);
CREATE INDEX IF NOT EXISTS idx_bundles_barcode ON public.bundles(bundle_barcode);
CREATE INDEX IF NOT EXISTS idx_scan_events_bundle ON public.scan_events(bundle_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_stage ON public.scan_events(stage_id);

-- qc_defect_logs
CREATE INDEX IF NOT EXISTS idx_qc_defect_wo ON public.qc_defect_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_defect_stage ON public.qc_defect_logs(stage_id);
CREATE INDEX IF NOT EXISTS idx_qc_defect_operator ON public.qc_defect_logs(operator_id);

-- inventory_items
CREATE INDEX IF NOT EXISTS idx_inventory_code ON public.inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_facility ON public.inventory_items(facility);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory_items(category);

-- order_documents & delivery_manifests
CREATE INDEX IF NOT EXISTS idx_order_docs_wo ON public.order_documents(work_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_manifests_wo ON public.delivery_manifests(work_order_id);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES (Fixes #7, #8)
-- ----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.blanket_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apply_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apply_cut_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apply_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchandiser_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_gate_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_defect_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_manifests ENABLE ROW LEVEL SECURITY;

-- Helper role checker function
CREATE OR REPLACE FUNCTION public.check_user_role(role_name public.role_type)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.1 APPLY_SUBMISSIONS POLICIES
-- Anon: Can INSERT new applications from public /apply portal (Fix #8)
DROP POLICY IF EXISTS apply_submissions_anon_insert ON public.apply_submissions;
CREATE POLICY apply_submissions_anon_insert ON public.apply_submissions
    FOR INSERT TO anon WITH CHECK (true);

-- Authenticated: Can insert
DROP POLICY IF EXISTS apply_submissions_auth_insert ON public.apply_submissions;
CREATE POLICY apply_submissions_auth_insert ON public.apply_submissions
    FOR INSERT TO authenticated WITH CHECK (true);

-- Admin: Full access
DROP POLICY IF EXISTS apply_submissions_admin ON public.apply_submissions;
CREATE POLICY apply_submissions_admin ON public.apply_submissions
    FOR ALL TO authenticated USING (public.check_user_role('admin'));

-- Merchandiser: SELECT all submissions
DROP POLICY IF EXISTS apply_submissions_merch_select ON public.apply_submissions;
CREATE POLICY apply_submissions_merch_select ON public.apply_submissions
    FOR SELECT TO authenticated USING (
        public.check_user_role('merchandiser') OR public.check_user_role('admin')
    );

-- Merchandiser: UPDATE assigned or unassigned submissions
DROP POLICY IF EXISTS apply_submissions_merch_update ON public.apply_submissions;
CREATE POLICY apply_submissions_merch_update ON public.apply_submissions
    FOR UPDATE TO authenticated USING (
        public.check_user_role('merchandiser') AND (
            assigned_merchandiser_id = auth.uid() OR assigned_merchandiser_id IS NULL
        )
    );

-- Customer: SELECT own submissions only via matching email or customer_id
DROP POLICY IF EXISTS apply_submissions_customer ON public.apply_submissions;
CREATE POLICY apply_submissions_customer ON public.apply_submissions
    FOR SELECT TO authenticated USING (
        contact_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- 8.2 APPLY_CUT_SHEETS POLICIES
DROP POLICY IF EXISTS apply_cut_sheets_anon_insert ON public.apply_cut_sheets;
CREATE POLICY apply_cut_sheets_anon_insert ON public.apply_cut_sheets
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS apply_cut_sheets_auth_insert ON public.apply_cut_sheets;
CREATE POLICY apply_cut_sheets_auth_insert ON public.apply_cut_sheets
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cut_sheets_admin_merch ON public.apply_cut_sheets;
CREATE POLICY cut_sheets_admin_merch ON public.apply_cut_sheets
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS cut_sheets_customer ON public.apply_cut_sheets;
CREATE POLICY cut_sheets_customer ON public.apply_cut_sheets
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.apply_submissions s
            JOIN public.profiles p ON p.email = s.contact_email
            WHERE s.id = apply_cut_sheets.submission_id AND p.id = auth.uid()
        )
    );

-- 8.3 APPLY_DOCUMENTS POLICIES
DROP POLICY IF EXISTS apply_docs_anon_insert ON public.apply_documents;
CREATE POLICY apply_docs_anon_insert ON public.apply_documents
    FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS apply_docs_auth_insert ON public.apply_documents;
CREATE POLICY apply_docs_auth_insert ON public.apply_documents
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS apply_docs_admin_merch ON public.apply_documents;
CREATE POLICY apply_docs_admin_merch ON public.apply_documents
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS apply_docs_customer ON public.apply_documents;
CREATE POLICY apply_docs_customer ON public.apply_documents
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.apply_submissions s
            JOIN public.profiles p ON p.email = s.contact_email
            WHERE s.id = apply_documents.submission_id AND p.id = auth.uid()
        )
    );

-- 8.4 UPDATE_REQUESTS POLICIES
DROP POLICY IF EXISTS update_req_admin_merch ON public.update_requests;
CREATE POLICY update_req_admin_merch ON public.update_requests
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS update_req_customer_select ON public.update_requests;
CREATE POLICY update_req_customer_select ON public.update_requests
    FOR SELECT TO authenticated USING (
        requested_by_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS update_req_customer_insert ON public.update_requests;
CREATE POLICY update_req_customer_insert ON public.update_requests
    FOR INSERT TO authenticated WITH CHECK (
        requested_by_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- 8.5 BLANKET_POS & WORK_ORDERS POLICIES
DROP POLICY IF EXISTS blanket_pos_admin_merch ON public.blanket_pos;
CREATE POLICY blanket_pos_admin_merch ON public.blanket_pos
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS blanket_pos_customer ON public.blanket_pos;
CREATE POLICY blanket_pos_customer ON public.blanket_pos
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.customer_id = blanket_pos.customer_id
        )
    );

DROP POLICY IF EXISTS work_orders_staff ON public.work_orders;
CREATE POLICY work_orders_staff ON public.work_orders
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('merchandiser') OR 
        public.check_user_role('production') OR 
        public.check_user_role('qc')
    );

DROP POLICY IF EXISTS work_orders_customer ON public.work_orders;
CREATE POLICY work_orders_customer ON public.work_orders
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.blanket_pos bp
            JOIN public.profiles p ON p.customer_id = bp.customer_id
            WHERE bp.id = work_orders.blanket_po_id AND p.id = auth.uid()
        )
    );

-- 8.6 SIZE GATES, BUNDLES, QC DEFECTS & INVENTORY POLICIES
DROP POLICY IF EXISTS size_gates_staff ON public.size_gate_records;
CREATE POLICY size_gates_staff ON public.size_gate_records
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('merchandiser') OR 
        public.check_user_role('production') OR 
        public.check_user_role('qc')
    );

DROP POLICY IF EXISTS size_gates_customer ON public.size_gate_records;
CREATE POLICY size_gates_customer ON public.size_gate_records
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.blanket_pos bp ON bp.id = wo.blanket_po_id
            JOIN public.profiles p ON p.customer_id = bp.customer_id
            WHERE wo.id = size_gate_records.work_order_id AND p.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS bundles_staff ON public.bundles;
CREATE POLICY bundles_staff ON public.bundles
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('production') OR 
        public.check_user_role('qc') OR
        public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS scan_events_staff ON public.scan_events;
CREATE POLICY scan_events_staff ON public.scan_events
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('production') OR 
        public.check_user_role('qc') OR
        public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS qc_defect_staff ON public.qc_defect_logs;
CREATE POLICY qc_defect_staff ON public.qc_defect_logs
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('qc') OR 
        public.check_user_role('production') OR
        public.check_user_role('merchandiser')
    );

DROP POLICY IF EXISTS inventory_staff ON public.inventory_items;
CREATE POLICY inventory_staff ON public.inventory_items
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('merchandiser') OR 
        public.check_user_role('production')
    );

DROP POLICY IF EXISTS order_docs_staff ON public.order_documents;
CREATE POLICY order_docs_staff ON public.order_documents
    FOR ALL TO authenticated USING (
        public.check_user_role('admin') OR 
        public.check_user_role('merchandiser') OR 
        public.check_user_role('production') OR 
        public.check_user_role('qc')
    );

DROP POLICY IF EXISTS order_docs_customer ON public.order_documents;
CREATE POLICY order_docs_customer ON public.order_documents
    FOR SELECT TO authenticated USING (
        is_customer_visible = TRUE AND
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.blanket_pos bp ON bp.id = wo.blanket_po_id
            JOIN public.profiles p ON p.customer_id = bp.customer_id
            WHERE wo.id = order_documents.work_order_id AND p.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS delivery_manifests_all ON public.delivery_manifests;
CREATE POLICY delivery_manifests_all ON public.delivery_manifests
    FOR ALL TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 9. STORAGE BUCKETS & STORAGE RLS (Fixes #9, #16, #17)
-- ----------------------------------------------------------------------------

-- Insert Storage Buckets if storage schema exists
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('apply-documents', 'apply-documents', true),
    ('apply-cut-sheets', 'apply-cut-sheets', true),
    ('update-attachments', 'update-attachments', true),
    ('brand-logos', 'brand-logos', true),
    ('qc-defect-photos', 'qc-defect-photos', true),
    ('wo-documents', 'wo-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage bucket access policies
DROP POLICY IF EXISTS "Public and anon access to apply upload buckets" ON storage.objects;
CREATE POLICY "Public and anon access to apply upload buckets" ON storage.objects
    FOR ALL TO anon, authenticated
    USING (bucket_id IN ('apply-documents', 'apply-cut-sheets', 'update-attachments', 'brand-logos', 'qc-defect-photos', 'wo-documents'))
    WITH CHECK (bucket_id IN ('apply-documents', 'apply-cut-sheets', 'update-attachments', 'brand-logos', 'qc-defect-photos', 'wo-documents'));

-- ----------------------------------------------------------------------------
-- 10. ATOMIC CONVERSION STORED PROCEDURE (Fix #11)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.convert_submission_to_blanket_po(
    p_submission_id UUID,
    p_custom_po_number TEXT DEFAULT NULL,
    p_override_total_qty INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_cust_id UUID;
    v_po_id UUID;
    v_po_num VARCHAR(50);
    v_total_qty INT := 0;
    v_cs RECORD;
    v_wo_id UUID;
    v_wo_num VARCHAR(50);
    v_wo_qty INT;
    v_wo_counter INT := 1;
    v_wo_results JSONB := '[]'::jsonb;
BEGIN
    -- 1. Load submission
    SELECT * INTO v_sub FROM public.apply_submissions WHERE id = p_submission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission % not found', p_submission_id;
    END IF;

    IF v_sub.status = 'converted' THEN
        RAISE EXCEPTION 'Submission % has already been converted to PO %', p_submission_id, v_sub.converted_to_po_id;
    END IF;

    -- 2. Find or create Customer
    SELECT id INTO v_cust_id FROM public.customers WHERE name ILIKE v_sub.company_name LIMIT 1;
    IF v_cust_id IS NULL THEN
        INSERT INTO public.customers (name)
        VALUES (v_sub.company_name)
        RETURNING id INTO v_cust_id;
    END IF;

    -- 3. Calculate total units if not provided
    IF p_override_total_qty IS NOT NULL AND p_override_total_qty > 0 THEN
        v_total_qty := p_override_total_qty;
    ELSE
        -- Sum up units across all linked cut sheets
        SELECT COALESCE(SUM((c->>'total_units')::int), 100)
        INTO v_total_qty
        FROM public.apply_cut_sheets cs,
             jsonb_array_elements(cs.sheet_data->'components') AS c
        WHERE cs.submission_id = p_submission_id;

        IF v_total_qty IS NULL OR v_total_qty = 0 THEN
            v_total_qty := 100;
        END IF;
    END IF;

    -- 4. Generate PO Number
    IF p_custom_po_number IS NOT NULL AND p_custom_po_number <> '' THEN
        v_po_num := p_custom_po_number;
    ELSE
        v_po_num := 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.apply_ref_seq')::TEXT, 4, '0');
    END IF;

    -- 5. Insert Blanket PO
    INSERT INTO public.blanket_pos (
        po_number,
        customer_id,
        customer_type,
        total_contract_qty,
        fulfilled_qty,
        po_type,
        source_submission_id,
        apply_reference_code,
        client_submitted
    ) VALUES (
        v_po_num,
        v_cust_id,
        'External',
        v_total_qty,
        0,
        'Blanket',
        p_submission_id,
        v_sub.apply_reference_code,
        TRUE
    ) RETURNING id INTO v_po_id;

    -- 6. Process linked cut sheets into Work Orders
    FOR v_cs IN SELECT * FROM public.apply_cut_sheets WHERE submission_id = p_submission_id LOOP
        v_wo_num := v_po_num || '-WO' || LPAD(v_wo_counter::TEXT, 2, '0');
        v_wo_counter := v_wo_counter + 1;

        -- Extract target qty and breakdown from sheet_data
        v_wo_qty := COALESCE((v_cs.sheet_data->'components'->0->>'total_units')::int, (v_cs.sheet_data->>'grand_total')::int, 100);

        INSERT INTO public.work_orders (
            blanket_po_id,
            wo_number,
            order_type,
            priority,
            style_name,
            colorway,
            wash_process_type,
            target_qty,
            size_breakdown,
            current_stage_id,
            status,
            source_cut_sheet_id,
            apply_reference_code
        ) VALUES (
            v_po_id,
            v_wo_num,
            'Bulk',
            'Normal',
            COALESCE(v_cs.style_no, 'Denim Style'),
            COALESCE(v_cs.sheet_data->'components'->0->>'color_lot', 'INDIGO'),
            COALESCE(v_cs.wash_dx_cd, v_cs.sheet_data->>'wash_type', 'STANDARD BIO-WASH'),
            v_wo_qty,
            COALESCE(v_cs.sheet_data->'components'->0->'size_matrix', v_cs.sheet_data->'fabrics'->0->'size_matrix', '{"28":10,"30":25,"32":30,"34":25,"36":10}'::jsonb),
            1,
            'Open',
            v_cs.id,
            v_sub.apply_reference_code
        ) RETURNING id INTO v_wo_id;

        -- Link cut sheet to WO
        UPDATE public.apply_cut_sheets
        SET work_order_id = v_wo_id, is_current = TRUE
        WHERE id = v_cs.id;

        -- Create initial Planned Size Gate Record (Fix #1)
        INSERT INTO public.size_gate_records (
            work_order_id,
            gate_name,
            size_breakdown,
            recorded_at
        ) VALUES (
            v_wo_id,
            'planned',
            COALESCE(v_cs.sheet_data->'components'->0->'size_matrix', v_cs.sheet_data->'fabrics'->0->'size_matrix', '{"28":10,"30":25,"32":30,"34":25,"36":10}'::jsonb),
            NOW()
        ) ON CONFLICT (work_order_id, gate_name) DO NOTHING;

        v_wo_results := v_wo_results || jsonb_build_object('wo_id', v_wo_id, 'wo_number', v_wo_num);
    END LOOP;

    -- If no cut sheets were attached, create one default Work Order
    IF v_wo_counter = 1 THEN
        v_wo_num := v_po_num || '-WO01';
        INSERT INTO public.work_orders (
            blanket_po_id,
            wo_number,
            order_type,
            priority,
            style_name,
            colorway,
            wash_process_type,
            target_qty,
            size_breakdown,
            current_stage_id,
            status,
            apply_reference_code
        ) VALUES (
            v_po_id,
            v_wo_num,
            'Bulk',
            'Normal',
            'Custom Garment Line',
            'INDIGO',
            'OZONE BIO-WASH',
            v_total_qty,
            '{"28": 10, "30": 25, "32": 30, "34": 25, "36": 10}'::jsonb,
            1,
            'Open',
            v_sub.apply_reference_code
        ) RETURNING id INTO v_wo_id;

        INSERT INTO public.size_gate_records (
            work_order_id,
            gate_name,
            size_breakdown,
            recorded_at
        ) VALUES (
            v_wo_id,
            'planned',
            '{"28": 10, "30": 25, "32": 30, "34": 25, "36": 10}'::jsonb,
            NOW()
        ) ON CONFLICT (work_order_id, gate_name) DO NOTHING;

        v_wo_results := v_wo_results || jsonb_build_object('wo_id', v_wo_id, 'wo_number', v_wo_num);
    END IF;

    -- 7. Update Submission Status
    UPDATE public.apply_submissions
    SET status = 'converted',
        converted_to_po_id = v_po_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_submission_id;

    RETURN jsonb_build_object(
        'po_id', v_po_id,
        'po_number', v_po_num,
        'work_orders', v_wo_results,
        'reference_code', v_sub.apply_reference_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
