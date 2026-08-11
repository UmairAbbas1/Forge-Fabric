-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 3: SHOP FLOOR EXECUTION, QC & LOGISTICS
-- Migration: 20260811000300_erp_mes_shop_floor_and_qc.sql
-- ==============================================================================

-- 1. CUT TICKETS (Cut Room Execution Unit)
CREATE TABLE IF NOT EXISTS public.cut_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    cut_number VARCHAR(100) UNIQUE NOT NULL,
    marker_name VARCHAR(150),
    fabric_lot_number VARCHAR(100),
    total_layers INT NOT NULL CHECK (total_layers > 0),
    planned_pcs INT NOT NULL CHECK (planned_pcs > 0),
    actual_pcs_cut INT DEFAULT 0 CHECK (actual_pcs_cut >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Planned' CHECK (
        status IN ('Planned', 'In_Progress', 'Completed', 'Cancelled')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cut_tickets_wo ON public.cut_tickets(work_order_id);
CREATE INDEX IF NOT EXISTS idx_cut_tickets_number ON public.cut_tickets(cut_number);
CREATE INDEX IF NOT EXISTS idx_cut_tickets_status ON public.cut_tickets(status);

-- 2. ALTER BUNDLES TABLE (Link to Cut Ticket & Granular SKU)
ALTER TABLE public.bundles
    ADD COLUMN IF NOT EXISTS cut_ticket_id UUID REFERENCES public.cut_tickets(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS sku_id UUID REFERENCES public.skus(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bundles_cut_ticket ON public.bundles(cut_ticket_id);
CREATE INDEX IF NOT EXISTS idx_bundles_sku ON public.bundles(sku_id);

-- 3. QC INSPECTIONS (Unified Quality Control Audit Log)
CREATE TABLE IF NOT EXISTS public.qc_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    operation_stage VARCHAR(50) NOT NULL DEFAULT 'Sewing_Inline',
    defect_category VARCHAR(50) NOT NULL DEFAULT 'Sewing' CHECK (
        defect_category IN ('Sewing', 'Fabric', 'Wash', 'Trims', 'Measurement', 'Packaging', 'Other')
    ),
    defect_code VARCHAR(100),
    inspected_qty INT NOT NULL CHECK (inspected_qty >= 0),
    passed_qty INT NOT NULL CHECK (passed_qty >= 0),
    failed_qty INT NOT NULL CHECK (failed_qty >= 0),
    rework_action VARCHAR(30) NOT NULL DEFAULT 'Pass' CHECK (
        rework_action IN ('Pass', 'Rework', 'Scrap', 'Hold')
    ),
    photo_url TEXT,
    root_cause_summary TEXT,
    corrective_action TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (passed_qty + failed_qty = inspected_qty)
);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_bundle ON public.qc_inspections(bundle_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_inspector ON public.qc_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_category ON public.qc_inspections(defect_category);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_rework ON public.qc_inspections(rework_action);

-- 4. PACKING LISTS (Shipment Container Header)
CREATE TABLE IF NOT EXISTS public.packing_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    packing_list_number VARCHAR(100) UNIQUE NOT NULL,
    destination_address_id UUID REFERENCES public.address_book(id) ON DELETE RESTRICT,
    shipped_date TIMESTAMPTZ,
    tracking_number VARCHAR(150),
    carrier_name VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'Draft' CHECK (
        status IN ('Draft', 'Packed', 'Shipped', 'Delivered', 'Cancelled')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packing_lists_customer ON public.packing_lists(customer_id);
CREATE INDEX IF NOT EXISTS idx_packing_lists_number ON public.packing_lists(packing_list_number);
CREATE INDEX IF NOT EXISTS idx_packing_lists_status ON public.packing_lists(status);

-- 5. ALTER CARTONS TABLE (Child of Packing List)
ALTER TABLE public.cartons
    ADD COLUMN IF NOT EXISTS packing_list_id UUID REFERENCES public.packing_lists(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS sku_id UUID REFERENCES public.skus(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cartons_packing_list ON public.cartons(packing_list_id);
CREATE INDEX IF NOT EXISTS idx_cartons_sku ON public.cartons(sku_id);

-- Timestamps triggers
DROP TRIGGER IF EXISTS trg_cut_tickets_updated_at ON public.cut_tickets;
CREATE TRIGGER trg_cut_tickets_updated_at BEFORE UPDATE ON public.cut_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_qc_inspections_updated_at ON public.qc_inspections;
CREATE TRIGGER trg_qc_inspections_updated_at BEFORE UPDATE ON public.qc_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_packing_lists_updated_at ON public.packing_lists;
CREATE TRIGGER trg_packing_lists_updated_at BEFORE UPDATE ON public.packing_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
