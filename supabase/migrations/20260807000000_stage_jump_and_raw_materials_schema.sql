-- ============================================================================
-- FORGE & FABRIC — MASTER PROMPT #4 DATABASE SCHEMA MIGRATION
-- Migration: 20260807000000_stage_jump_and_raw_materials_schema.sql
-- Direct Stage Navigation Audit + Raw Materials Intake + Facility Management
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND PROFILES WITH FACILITY IF NOT ALREADY PRESENT
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS facility VARCHAR(30) DEFAULT 'Sewing';

-- ----------------------------------------------------------------------------
-- 2. STAGE JUMP AUDIT LOGS (stage_jump_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stage_jump_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    from_stage_id INT NOT NULL,
    to_stage_id INT NOT NULL,
    jumped_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    jump_reason TEXT,
    validation_passed BOOLEAN NOT NULL DEFAULT TRUE,
    validation_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_stage_jump_logs_work_order_id ON public.stage_jump_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_stage_jump_logs_jumped_by ON public.stage_jump_logs(jumped_by);
CREATE INDEX IF NOT EXISTS idx_stage_jump_logs_created_at ON public.stage_jump_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.stage_jump_logs ENABLE ROW LEVEL SECURITY;

-- Stage Jump Logs Policies
CREATE POLICY "stage_jump_logs_admin_all" ON public.stage_jump_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "stage_jump_logs_merchandiser_select" ON public.stage_jump_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'merchandiser'
        )
    );

CREATE POLICY "stage_jump_logs_worker_select" ON public.stage_jump_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('production', 'qc')
        )
    );

CREATE POLICY "stage_jump_logs_customer_select" ON public.stage_jump_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.blanket_pos bp ON wo.blanket_po_id = bp.id
            JOIN public.customers c ON bp.customer_id = c.id
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE wo.id = stage_jump_logs.work_order_id
            AND p.role = 'customer'
            AND p.email = c.contact
        )
    );

-- ----------------------------------------------------------------------------
-- 3. RAW MATERIALS INTAKE (raw_materials_intake)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.raw_materials_intake_seq START 1;

CREATE TABLE IF NOT EXISTS public.raw_materials_intake (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_number VARCHAR(50) UNIQUE NOT NULL,
    facility VARCHAR(30) NOT NULL DEFAULT 'Sewing Facility', -- 'Sewing Facility' | 'Laundry Facility'
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    blanket_po_id UUID REFERENCES public.blanket_pos(id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Fabric',
        -- 'Fabric' | 'Trim' | 'Thread' | 'Button' | 'Rivet' | 'Zipper' | 'Patch' | 'Label' | 'Chemical' | 'Packaging' | 'Other'
    supplier VARCHAR(150),
    supplier_po VARCHAR(50),
    quantity_expected NUMERIC(12,2) DEFAULT 0,
    quantity_received NUMERIC(12,2) DEFAULT 0,
    quantity_damaged NUMERIC(12,2) DEFAULT 0,
    quantity_accepted NUMERIC(12,2) GENERATED ALWAYS AS (quantity_received - quantity_damaged) STORED,
    unit VARCHAR(30) NOT NULL DEFAULT 'Yards',
        -- 'Yards' | 'Meters' | 'Rolls' | 'Pieces' | 'Kg' | 'Lbs' | 'Dozens' | 'Cards' | 'Bags'
    lot_number VARCHAR(100),
    shade_lot VARCHAR(100),
    storage_location VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'Received',
        -- 'Expected' | 'In Transit' | 'Received' | 'In QC' | 'Approved' | 'Rejected' | 'Partial'
    received_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    inspected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function for auto-generating RMI-YYYY-XXXX code
CREATE OR REPLACE FUNCTION public.generate_intake_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.intake_number IS NULL OR NEW.intake_number = '' THEN
        NEW.intake_number = 'RMI-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.raw_materials_intake_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_intake_code ON public.raw_materials_intake;
CREATE TRIGGER trg_generate_intake_code
    BEFORE INSERT ON public.raw_materials_intake
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_intake_code();

-- Auto update timestamp trigger
DROP TRIGGER IF EXISTS trg_raw_materials_intake_updated_at ON public.raw_materials_intake;
CREATE TRIGGER trg_raw_materials_intake_updated_at
    BEFORE UPDATE ON public.raw_materials_intake
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for Raw Materials
CREATE INDEX IF NOT EXISTS idx_raw_mat_intake_num ON public.raw_materials_intake(intake_number);
CREATE INDEX IF NOT EXISTS idx_raw_mat_facility ON public.raw_materials_intake(facility);
CREATE INDEX IF NOT EXISTS idx_raw_mat_category ON public.raw_materials_intake(category);
CREATE INDEX IF NOT EXISTS idx_raw_mat_status ON public.raw_materials_intake(status);
CREATE INDEX IF NOT EXISTS idx_raw_mat_received_date ON public.raw_materials_intake(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_mat_wo ON public.raw_materials_intake(work_order_id);

-- Enable RLS
ALTER TABLE public.raw_materials_intake ENABLE ROW LEVEL SECURITY;

-- Raw Materials Intake RLS Policies
CREATE POLICY "raw_materials_admin_all" ON public.raw_materials_intake
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "raw_materials_merchandiser_all" ON public.raw_materials_intake
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'merchandiser'
        )
    );

CREATE POLICY "raw_materials_worker_facility_access" ON public.raw_materials_intake
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role IN ('production', 'qc')
            AND (p.facility IS NULL OR p.facility = '' OR p.facility = raw_materials_intake.facility OR (p.facility = 'Sewing' AND raw_materials_intake.facility = 'Sewing Facility') OR (p.facility = 'Laundry' AND raw_materials_intake.facility = 'Laundry Facility'))
        )
    );

CREATE POLICY "raw_materials_customer_select" ON public.raw_materials_intake
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.blanket_pos bp ON wo.blanket_po_id = bp.id
            JOIN public.customers c ON bp.customer_id = c.id
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE wo.id = raw_materials_intake.work_order_id
            AND p.role = 'customer'
            AND p.email = c.contact
        )
    );
