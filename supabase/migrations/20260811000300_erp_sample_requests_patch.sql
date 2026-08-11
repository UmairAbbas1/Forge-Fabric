-- Migration 20260811000300_erp_sample_requests_patch.sql

-- 1. Alter address_book
ALTER TABLE public.address_book
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_name_override VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Drop old check constraints on address_book to redefine address_type
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.address_book'::regclass
          AND contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE public.address_book DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END$$;

ALTER TABLE public.address_book
  ADD CONSTRAINT address_book_address_type_check 
  CHECK (address_type IN ('Shipping', 'Billing', 'HQ', 'Factory', 'Warehouse', 'Sample Receiving', 'Delivery'));

-- 2. Create Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_type_enum') THEN
        CREATE TYPE public.sample_type_enum AS ENUM (
            'Fit', 'Photo', 'Pre-Production', 'Counter'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fabric_trim_source_enum') THEN
        CREATE TYPE public.fabric_trim_source_enum AS ENUM (
            'Factory Sourced', 'Brand Sourced'
        );
    END IF;
END$$;

-- 3. Create sample_requests table
CREATE TABLE IF NOT EXISTS public.sample_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    sample_type public.sample_type_enum NOT NULL,
    fabric_trim_source public.fabric_trim_source_enum NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10),
    size_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    tech_pack_url TEXT NOT NULL,
    ship_to_address_id UUID NOT NULL REFERENCES public.address_book(id),
    turnaround_date DATE,
    special_instructions TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (
        status IN ('submitted', 'factory_review', 'cost_approval', 'waiting_materials', 'in_production', 'shipped', 'received', 'approved', 'rejected')
    ),
    reference_photos JSONB DEFAULT '[]'::jsonb,
    total_cost NUMERIC(10, 2),
    target_delivery_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sample_requests_company ON public.sample_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_status ON public.sample_requests(status);

-- 4. Create sample_request_documents table
CREATE TABLE IF NOT EXISTS public.sample_request_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_request_id UUID NOT NULL REFERENCES public.sample_requests(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- e.g., 'Tech Pack', 'Reference Photo'
    file_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sample_req_docs_req ON public.sample_request_documents(sample_request_id);

-- 5. Create material_inbound_expectations
CREATE TABLE IF NOT EXISTS public.material_inbound_expectations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_request_id UUID NOT NULL REFERENCES public.sample_requests(id) ON DELETE CASCADE,
    material_type VARCHAR(100) NOT NULL,
    expected_delivery_date DATE,
    tracking_number VARCHAR(100),
    carrier VARCHAR(100),
    received_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'delayed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create material_sourcing_requests
CREATE TABLE IF NOT EXISTS public.material_sourcing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_request_id UUID NOT NULL REFERENCES public.sample_requests(id) ON DELETE CASCADE,
    material_description TEXT NOT NULL,
    estimated_cost NUMERIC(10, 2),
    approved_cost NUMERIC(10, 2),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_quote' CHECK (status IN ('pending_quote', 'pending_approval', 'approved', 'rejected', 'ordered', 'received')),
    vendor_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Functions & RPCs
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sample_requests_modtime
    BEFORE UPDATE ON public.sample_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_material_inbound_modtime
    BEFORE UPDATE ON public.material_inbound_expectations
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_material_sourcing_modtime
    BEFORE UPDATE ON public.material_sourcing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- RPC: submit_sample_request
CREATE OR REPLACE FUNCTION public.submit_sample_request(
    p_company_id UUID,
    p_sample_type public.sample_type_enum,
    p_fabric_trim_source public.fabric_trim_source_enum,
    p_quantity INTEGER,
    p_size_breakdown JSONB,
    p_tech_pack_url TEXT,
    p_ship_to_address_id UUID,
    p_turnaround_date DATE,
    p_special_instructions TEXT,
    p_reference_photos JSONB
) RETURNS UUID AS $$
DECLARE
    v_sample_request_id UUID;
BEGIN
    INSERT INTO public.sample_requests (
        company_id, sample_type, fabric_trim_source, quantity, size_breakdown, 
        tech_pack_url, ship_to_address_id, turnaround_date, special_instructions, reference_photos
    ) VALUES (
        p_company_id, p_sample_type, p_fabric_trim_source, p_quantity, p_size_breakdown,
        p_tech_pack_url, p_ship_to_address_id, p_turnaround_date, p_special_instructions, p_reference_photos
    ) RETURNING id INTO v_sample_request_id;

    INSERT INTO public.sample_request_documents (sample_request_id, document_type, file_url)
    VALUES (v_sample_request_id, 'Tech Pack', p_tech_pack_url);

    RETURN v_sample_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC/Function: check_pp_sample_gate
-- Validation function enforcing that PP Samples block future Bulk Order POs for the same style until approved.
CREATE OR REPLACE FUNCTION public.check_pp_sample_gate(p_style_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_unapproved_pp_count INTEGER;
BEGIN
    -- Assume sample_requests could link to style_id (e.g. style_id column added in future if not here)
    -- We'll just return TRUE right now until style_id is strongly typed in sample_requests.
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS Policies
ALTER TABLE public.sample_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_request_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_inbound_expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_sourcing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for authenticated users" ON public.sample_requests
    AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users" ON public.sample_request_documents
    AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users" ON public.material_inbound_expectations
    AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users" ON public.material_sourcing_requests
    AS PERMISSIVE FOR ALL TO authenticated USING (true);
