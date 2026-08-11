-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 2: SALES PLANNING, POs & PROFILES ENHANCEMENT
-- Migration: 20260811000200_erp_sales_planning_and_wos.sql
-- ==============================================================================

-- 1. PURCHASE ORDERS (Sales PO Header)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    po_number VARCHAR(100) UNIQUE NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_due_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft' CHECK (
        status IN ('Draft', 'Submitted', 'Approved', 'In_Production', 'Completed', 'Cancelled', 'CHANGE_PENDING')
    ),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_customer ON public.purchase_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);

-- 2. PO LINE ITEMS (SKU Demand Granularity)
CREATE TABLE IF NOT EXISTS public.po_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE RESTRICT,
    ordered_qty INT NOT NULL CHECK (ordered_qty > 0),
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    total_amount NUMERIC(14,2) GENERATED ALWAYS AS (ordered_qty * unit_price) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_line_items_po ON public.po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_sku ON public.po_line_items(sku_id);

-- 3. ALTER PROFILES TABLE (Invite-based RBAC & Company Link)
-- Expand role_type enum if it exists, or extend text checks
DO $$
BEGIN
    -- Add enum values to role_type if they don't exist
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'super_admin';
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'production_manager';
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'cutting_supervisor';
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'sewing_supervisor';
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'qc_inspector';
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'warehouse';
        ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'finance';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS facility_scope VARCHAR(50) DEFAULT 'Sewing Facility',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 4. ALTER WORK ORDERS TABLE (Link to PO Line Items & Deprecate Free-Text Fields)
ALTER TABLE public.work_orders
    ADD COLUMN IF NOT EXISTS po_line_item_id UUID REFERENCES public.po_line_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_po_line_item ON public.work_orders(po_line_item_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_facility_id ON public.work_orders(facility_id);

-- Explicitly document deprecation of free-text fields in schema
COMMENT ON COLUMN public.work_orders.style_name IS 'DEPRECATED: Superseded by po_line_item_id -> sku_id -> styles.style_name';
COMMENT ON COLUMN public.work_orders.colorway IS 'DEPRECATED: Superseded by po_line_item_id -> sku_id -> skus.colorway';

-- Timestamps triggers
DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_po_line_items_updated_at ON public.po_line_items;
CREATE TRIGGER trg_po_line_items_updated_at BEFORE UPDATE ON public.po_line_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
