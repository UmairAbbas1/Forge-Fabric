-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 1: CORE MASTER ENTITIES
-- Migration: 20260811000100_erp_core_master_entities.sql
-- ==============================================================================

-- 1. MIGRATION EXCEPTIONS LOG TABLE
-- Captures non-mappable historical records during schema migrations
CREATE TABLE IF NOT EXISTS public.migration_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table VARCHAR(100) NOT NULL,
    source_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COMPANY MASTER (CRM Core)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE,
    tax_id VARCHAR(100),
    company_type VARCHAR(50) NOT NULL DEFAULT 'Customer' CHECK (
        company_type IN ('Customer', 'Vendor', 'Internal_Factory', 'Subcontractor')
    ),
    status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (
        status IN ('Active', 'Inactive', 'On_Hold')
    ),
    legacy_customer_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for legacy lookup & company type filtering
CREATE INDEX IF NOT EXISTS idx_companies_legacy_id ON public.companies(legacy_customer_id);
CREATE INDEX IF NOT EXISTS idx_companies_type ON public.companies(company_type);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

-- 3. ADDRESS BOOK
CREATE TABLE IF NOT EXISTS public.address_book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    address_type VARCHAR(30) NOT NULL DEFAULT 'Shipping' CHECK (
        address_type IN ('Shipping', 'Billing', 'HQ', 'Factory', 'Warehouse')
    ),
    street_1 VARCHAR(255) NOT NULL,
    street_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(30),
    country VARCHAR(100) NOT NULL DEFAULT 'United States',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_address_book_company ON public.address_book(company_id);
CREATE INDEX IF NOT EXISTS idx_address_book_type ON public.address_book(company_id, address_type);

-- 4. CONTACT BOOK
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    job_title VARCHAR(100),
    is_primary_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);

-- 5. SIZE RANGE MASTER
CREATE TABLE IF NOT EXISTS public.size_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    sizes JSONB NOT NULL CHECK (jsonb_typeof(sizes) = 'array' AND jsonb_array_length(sizes) > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 3 Generic Size Ranges to prove non-jeans flexibility
INSERT INTO public.size_ranges (name, description, sizes)
VALUES
    (
        'Adult Denim Numeric',
        'Standard adult denim waist sizes in inches',
        '["28", "29", "30", "31", "32", "33", "34", "36", "38", "40"]'::jsonb
    ),
    (
        'Alpha Apparel Standard',
        'Standard unisex alpha sizes for knits/tops',
        '["XS", "S", "M", "L", "XL", "2XL", "3XL"]'::jsonb
    ),
    (
        'Kids Toddler Age',
        'Toddler and young kids sizing scale',
        '["2T", "3T", "4T", "5T", "6", "7", "8"]'::jsonb
    )
ON CONFLICT (name) DO NOTHING;

-- 6. STYLE MASTER (PLM Core)
CREATE TABLE IF NOT EXISTS public.styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_code VARCHAR(100) UNIQUE NOT NULL,
    style_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Denim' CHECK (
        category IN ('Denim', 'Knitwear', 'Outerwear', 'Woven Shirt', 'Activewear', 'Accessories', 'Other')
    ),
    size_range_id UUID NOT NULL REFERENCES public.size_ranges(id) ON DELETE RESTRICT,
    description TEXT,
    tech_pack_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_styles_code ON public.styles(style_code);
CREATE INDEX IF NOT EXISTS idx_styles_category ON public.styles(category);
CREATE INDEX IF NOT EXISTS idx_styles_size_range ON public.styles(size_range_id);

-- 7. SKU MASTER (Granular Variants)
CREATE TABLE IF NOT EXISTS public.skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
    colorway VARCHAR(100) NOT NULL,
    size_code VARCHAR(30) NOT NULL,
    sku_code VARCHAR(150) UNIQUE NOT NULL,
    barcode_ean VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(style_id, colorway, size_code)
);

CREATE INDEX IF NOT EXISTS idx_skus_style ON public.skus(style_id);
CREATE INDEX IF NOT EXISTS idx_skus_code ON public.skus(sku_code);

-- Function & Trigger to auto-populate sku_code as {style_code}-{colorway}-{size_code} if missing
CREATE OR REPLACE FUNCTION public.generate_sku_code()
RETURNS TRIGGER AS $$
DECLARE
    v_style_code VARCHAR;
BEGIN
    SELECT style_code INTO v_style_code FROM public.styles WHERE id = NEW.style_id;
    IF v_style_code IS NULL THEN
        RAISE EXCEPTION 'Style ID % not found for SKU generation', NEW.style_id;
    END IF;
    
    IF NEW.sku_code IS NULL OR NEW.sku_code = '' THEN
        NEW.sku_code = UPPER(REGEXP_REPLACE(v_style_code || '-' || NEW.colorway || '-' || NEW.size_code, '\s+', '', 'g'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_sku_code ON public.skus;
CREATE TRIGGER trg_generate_sku_code
    BEFORE INSERT OR UPDATE ON public.skus
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_sku_code();

-- 8. BOM TEMPLATES (Bill of Materials)
CREATE TABLE IF NOT EXISTS public.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_id UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
    colorway VARCHAR(100) NOT NULL DEFAULT 'ALL',
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    consumption_qty NUMERIC(10,4) NOT NULL CHECK (consumption_qty > 0),
    unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'Yards',
    waste_allowance_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (waste_allowance_pct >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boms_style ON public.boms(style_id);
CREATE INDEX IF NOT EXISTS idx_boms_item ON public.boms(item_id);

-- Auto-update updated_at triggers
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_address_book_updated_at ON public.address_book;
CREATE TRIGGER trg_address_book_updated_at BEFORE UPDATE ON public.address_book FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_size_ranges_updated_at ON public.size_ranges;
CREATE TRIGGER trg_size_ranges_updated_at BEFORE UPDATE ON public.size_ranges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_styles_updated_at ON public.styles;
CREATE TRIGGER trg_styles_updated_at BEFORE UPDATE ON public.styles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_skus_updated_at ON public.skus;
CREATE TRIGGER trg_skus_updated_at BEFORE UPDATE ON public.skus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_boms_updated_at ON public.boms;
CREATE TRIGGER trg_boms_updated_at BEFORE UPDATE ON public.boms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
