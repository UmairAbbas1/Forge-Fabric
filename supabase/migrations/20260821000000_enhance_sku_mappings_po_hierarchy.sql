-- ==============================================================================
-- FORGE & FABRIC INDUSTRIES, INC. — SKU MAPPINGS PER-PO HIERARCHY MIGRATION
-- Enhances public.sku_mappings with po_number, customer_name, and seeds pristine data
-- ==============================================================================

-- 1. ADD MISSING COLUMNS TO SKU_MAPPINGS
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. POLICIES FOR FULL ACCESS
ALTER TABLE IF EXISTS public.sku_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sku_mappings_full_access" ON public.sku_mappings;
CREATE POLICY "sku_mappings_full_access" ON public.sku_mappings FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 3. SEED PRISTINE PER-PO SKU MAPPINGS FOR THE 4 BRANDS
DELETE FROM public.sku_mappings;

INSERT INTO public.sku_mappings (
  id, customer_name, brand_name, po_number, customer_sku, factory_code, style_name, colorway, notes
) VALUES
-- WEISSMADE
(
  gen_random_uuid(), 'Weissmade', 'Weissmade', 'PO-WM-2026-101', 'WM-RAW-SLM-01', 'FF-DEN-SLIM-SLV', 'Japanese Selvedge Slim Jean', 'Indigo Rinse', 'Primary core run for 13.5oz cone selvedge'
),
(
  gen_random_uuid(), 'Weissmade', 'Weissmade', 'PO-WM-2026-102', 'WM-JKT-TYP3', 'FF-JKT-TRK-HVY', 'Heavyweight Type III Trucker', 'Vintage Blue', '14oz rigid denim trucker jacket'
),

-- FEAR OF GOD
(
  gen_random_uuid(), 'Fear of God', 'Fear of God Essentials', 'PO-FOG-2026-081', 'FOG-ESS-DNM-26', 'FF-DEN-RLX-VNT', 'Relaxed Vintage Wash Denim Jeans', 'Vintage Blue', 'Enzyme stone washed with Italian hardware'
),
(
  gen_random_uuid(), 'Fear of God', 'Fear of God Essentials', 'PO-FOG-2026-082', 'FOG-OVR-SHRT-02', 'FF-TOP-OVR-OZN', 'Oversized Denim Overshirt', 'Stone Wash', 'Laser whiskers and ozone dry finishing'
),

-- SERVADE
(
  gen_random_uuid(), 'Servade', 'Servade', 'PO-SRV-2026-501', 'SRV-5PKT-STR', 'FF-DEN-STR-CLS', '5-Pocket Classic Straight Leg', 'Mid Blue', 'Turkish ring-spun 12oz denim'
),
(
  gen_random_uuid(), 'Servade', 'Servade', 'PO-SRV-2026-502', 'SRV-CHN-ECRU', 'FF-BTM-CHN-TWL', 'Garment Dyed Twill Chino', 'Ecru', 'Enzyme softener wash with felled seams'
),

-- UMAIRCO
(
  gen_random_uuid(), 'UmairCO', 'UmairCO', 'PO-UM-2026-301', 'UM-STR-BLK-01', 'FF-DEN-STR-PRF', 'Performance Stretch Comfort Jean', 'Jet Black', 'DualFX Lycra high-recovery denim'
),
(
  gen_random_uuid(), 'UmairCO', 'UmairCO', 'PO-UM-2026-302', 'UM-CRG-TAC-02', 'FF-BTM-CRG-OZN', 'Tactical Denim Multi-Pocket Cargo', 'Stone Wash', 'Heavy enzyme stone wash with reinforced knees'
);

-- 4. REALTIME PUBLICATION REFRESH
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sku_mappings;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
