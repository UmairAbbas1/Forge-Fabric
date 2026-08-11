-- Migration 20260811001000_multi_style_product_types.sql
-- Multi-Style Blocks, Garment Product Types, Fabric Types, and Repeatable Trims BOM

-- 1. Extend apply_submissions with multi-style & product type JSONB structures
ALTER TABLE public.apply_submissions
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(100) DEFAULT 'Denim/Bottoms',
  ADD COLUMN IF NOT EXISTS fabric_type VARCHAR(50) DEFAULT 'Woven',
  ADD COLUMN IF NOT EXISTS style_blocks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trim_components JSONB DEFAULT '[]'::jsonb;

-- 2. Extend purchase_orders with multi-style & product type columns
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(100) DEFAULT 'Denim/Bottoms',
  ADD COLUMN IF NOT EXISTS fabric_type VARCHAR(50) DEFAULT 'Woven',
  ADD COLUMN IF NOT EXISTS style_blocks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trim_components JSONB DEFAULT '[]'::jsonb;

-- 3. Create size_templates table for reusable custom size templates
CREATE TABLE IF NOT EXISTS public.size_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    template_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Custom',
    size_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_size_templates_company ON public.size_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_size_templates_category ON public.size_templates(category);

-- Enable RLS
ALTER TABLE public.size_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for size_templates
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can read preset size templates" ON public.size_templates;
    DROP POLICY IF EXISTS "Users can read own company size templates" ON public.size_templates;
    DROP POLICY IF EXISTS "Users can insert custom size templates" ON public.size_templates;
END$$;

CREATE POLICY "Anyone can read preset size templates"
    ON public.size_templates FOR SELECT
    TO authenticated, anon
    USING (is_preset = TRUE);

CREATE POLICY "Users can read own company size templates"
    ON public.size_templates FOR SELECT
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

CREATE POLICY "Users can insert custom size templates"
    ON public.size_templates FOR INSERT
    TO authenticated
    WITH CHECK (true);

COMMENT ON TABLE public.size_templates IS 'Stores standard and custom reusable size templates for garment intake.';
