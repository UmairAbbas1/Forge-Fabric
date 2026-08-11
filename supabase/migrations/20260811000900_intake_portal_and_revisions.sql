-- Migration 20260811000900_intake_portal_and_revisions.sql
-- Backend schema additions for Intake Portal Address Book & Real-Time PO Revisions

-- 1. Extend apply_submissions table with billing/shipping address & revision columns
ALTER TABLE public.apply_submissions
  ADD COLUMN IF NOT EXISTS billing_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_zip VARCHAR(30),
  ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100) DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS shipping_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_zip VARCHAR(30),
  ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100) DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS existing_order_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS revision_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS revision_notes TEXT;

-- 2. Extend purchase_orders table for workflow stage & revision tracking
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT '1/13',
  ADD COLUMN IF NOT EXISTS tech_pack_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS style_number_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;

-- 3. Create PO Revision Requests table
CREATE TABLE IF NOT EXISTS public.po_revision_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    po_number VARCHAR(100) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    revision_type VARCHAR(50) NOT NULL CHECK (
        revision_type IN ('size_qty', 'cut_sheet', 'tech_pack', 'delivery_date', 'general')
    ),
    notes TEXT,
    requested_by UUID REFERENCES auth.users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review' CHECK (
        status IN ('pending_review', 'under_review', 'approved', 'rejected', 'applied')
    ),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_revisions_po ON public.po_revision_requests(po_number);
CREATE INDEX IF NOT EXISTS idx_po_revisions_company ON public.po_revision_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_po_revisions_status ON public.po_revision_requests(status);

-- Enable RLS
ALTER TABLE public.po_revision_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for po_revision_requests
DO $$
BEGIN
    DROP POLICY IF EXISTS "Customers can view their own PO revision requests" ON public.po_revision_requests;
    DROP POLICY IF EXISTS "Customers can insert PO revision requests" ON public.po_revision_requests;
    DROP POLICY IF EXISTS "Staff can manage all PO revision requests" ON public.po_revision_requests;
END$$;

CREATE POLICY "Customers can view their own PO revision requests"
    ON public.po_revision_requests FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'merchandiser', 'production_manager')
        )
    );

CREATE POLICY "Customers can insert PO revision requests"
    ON public.po_revision_requests FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Staff can manage all PO revision requests"
    ON public.po_revision_requests FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'merchandiser', 'production_manager')
        )
    );

-- 4. Create trigger to update updated_at on po_revision_requests
CREATE OR REPLACE FUNCTION public.update_po_revision_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_revision_updated_at ON public.po_revision_requests;
CREATE TRIGGER trg_po_revision_updated_at
    BEFORE UPDATE ON public.po_revision_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_po_revision_timestamp();

COMMENT ON TABLE public.po_revision_requests IS 'Tracks customer PO revision requests submitted from the intake portal.';
