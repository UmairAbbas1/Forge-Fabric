-- ============================================================================
-- Migration: 20260811000800_erp_tenant_branding.sql
-- Description: Tenant Branding & White-Label Configuration (Blueprint Section 6.2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL DEFAULT 'Forge & Fabric Apparel ERP',
    logo_url TEXT,
    primary_color VARCHAR(16) NOT NULL DEFAULT '#1e3a8a', -- Indigo Blue
    secondary_color VARCHAR(16) NOT NULL DEFAULT '#0f172a', -- Slate Dark
    accent_color VARCHAR(16) NOT NULL DEFAULT '#d97706', -- Amber Gold
    support_email VARCHAR(255) DEFAULT 'support@forgefabric.com',
    support_phone VARCHAR(64) DEFAULT '+1 (800) 555-DENIM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default tenant configuration if table is empty
INSERT INTO public.tenant_config (company_name, primary_color, secondary_color, accent_color, support_email)
SELECT 'Forge & Fabric Apparel ERP', '#1e3a8a', '#0f172a', '#d97706', 'support@forgefabric.com'
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_config);

-- Enable RLS
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and anonymous users to READ tenant_config (for branding & white labeling)
DROP POLICY IF EXISTS "Public tenant config read access" ON public.tenant_config;
CREATE POLICY "Public tenant config read access" ON public.tenant_config
    FOR SELECT TO public USING (true);

-- Allow admins to update tenant_config
DROP POLICY IF EXISTS "Admin tenant config update access" ON public.tenant_config;
CREATE POLICY "Admin tenant config update access" ON public.tenant_config
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'admin')
        )
    );
