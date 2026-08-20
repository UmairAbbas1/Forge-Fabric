-- ==============================================================================
-- FORGE & FABRIC INDUSTRIES, INC. — MASTER CONSOLIDATED DATABASE SCRIPT (V10)
-- Client Brand Name: WiesMade (https://wiesmade.com/)
-- Official Master Email: wiesmade@forgefabric.com
-- Official Master Brands:
-- 1. WiesMade (wiesmade@forgefabric.com)
-- 2. Fear of God (fearofgod@forgefabric.com)
-- 3. Servade (ahmad234@gmail.com)
-- 4. UmairCO (umair.abbas@cybersoftna.com)
-- ==============================================================================

-- ==========================================
-- 1. SCHEMA ENHANCEMENTS & TABLE CREATIONS
-- ==========================================

-- 1.1 Companies Table Column Enhancements
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS website TEXT;

-- 1.2 Sample Requests Table Adjustments
ALTER TABLE IF EXISTS public.sample_requests ALTER COLUMN tech_pack_url DROP NOT NULL;
ALTER TABLE IF EXISTS public.sample_requests ALTER COLUMN ship_to_address_id DROP NOT NULL;

-- 1.3 Customer SKU Mappings Table
CREATE TABLE IF NOT EXISTS public.sku_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_code VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES public.profiles(id),
    customer_sku VARCHAR(100) NOT NULL,
    brand_name VARCHAR(100),
    style_name VARCHAR(100),
    colorway VARCHAR(50),
    po_number VARCHAR(100),
    customer_name VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all hierarchical columns exist on sku_mappings
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.sku_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ==========================================
-- 2. ENABLE RLS POLICIES FOR FULL ACCESS
-- ==========================================
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_all_full_access" ON public.orders;
CREATE POLICY "orders_all_full_access" ON public.orders FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_all_full_access" ON public.profiles;
CREATE POLICY "profiles_all_full_access" ON public.profiles FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_all_full_access" ON public.companies;
CREATE POLICY "companies_all_full_access" ON public.companies FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.apply_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apply_submissions_all_full_access" ON public.apply_submissions;
CREATE POLICY "apply_submissions_all_full_access" ON public.apply_submissions FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.sample_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sample_requests_all_full_access" ON public.sample_requests;
CREATE POLICY "sample_requests_all_full_access" ON public.sample_requests FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.sku_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sku_mappings_full_access" ON public.sku_mappings;
CREATE POLICY "sku_mappings_full_access" ON public.sku_mappings FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);


-- ==========================================
-- 3. SEED MASTER CUSTOMER COMPANIES (SAFE ON CONFLICT)
-- ==========================================
DO $$
BEGIN
  -- Rename any existing 'Weissmade' row to 'WiesMade' if present
  UPDATE public.companies 
  SET name = 'WiesMade', code = 'WIES-CUST', website = 'https://wiesmade.com/' 
  WHERE LOWER(name) IN ('weissmade', 'weiss made', 'wies made');

  -- Insert or update the 4 master brands
  INSERT INTO public.companies (name, code, tax_id, company_type, status, website)
  VALUES
    ('WiesMade', 'WIES-CUST', 'US-9823145-WM', 'Customer', 'Active', 'https://wiesmade.com/'),
    ('Fear of God', 'FOG-CUST', 'US-8712903-FOG', 'Customer', 'Active', 'https://fearofgod.com/'),
    ('Servade', 'SRV-CUST', 'US-4491201-SRV', 'Customer', 'Active', 'https://servade.com/'),
    ('UmairCO', 'UMAIR-CUST', 'US-5519820-UM', 'Customer', 'Active', 'https://forgefabric.com/')
  ON CONFLICT (name) DO UPDATE SET
    code = EXCLUDED.code,
    tax_id = EXCLUDED.tax_id,
    company_type = EXCLUDED.company_type,
    status = EXCLUDED.status,
    website = EXCLUDED.website;
END $$;


-- ==========================================
-- 4. CLEAN UP PROFILES & UPDATE EMAIL TO wiesmade@forgefabric.com
-- ==========================================
DO $$
BEGIN
  -- Update auth.users email if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    UPDATE auth.users 
    SET email = 'wiesmade@forgefabric.com' 
    WHERE LOWER(email) = 'weissmade@forgefabric.com';
  END IF;
END $$;

DELETE FROM public.profiles 
WHERE role = 'customer' 
  AND LOWER(email) NOT IN (
    'wiesmade@forgefabric.com',
    'weissmade@forgefabric.com',
    'fearofgod@forgefabric.com',
    'ahmad234@gmail.com',
    'umair.abbas@cybersoftna.com'
  );

-- Update and ensure active profile records with dynamic company_id lookups
UPDATE public.profiles
SET email = 'wiesmade@forgefabric.com',
    customer_name = 'WiesMade', 
    company_name = 'WiesMade', 
    role = 'customer', 
    full_name = 'WiesMade Brand Representative', 
    status = 'active', 
    is_portal_user = true, 
    portal_access_enabled = true, 
    deactivated = false, 
    company_id = (SELECT id FROM public.companies WHERE LOWER(name) = 'wiesmade' LIMIT 1)
WHERE LOWER(email) IN ('wiesmade@forgefabric.com', 'weissmade@forgefabric.com');

UPDATE public.profiles
SET customer_name = 'Fear of God', 
    company_name = 'Fear of God', 
    role = 'customer', 
    full_name = 'Fear of God Brand Representative', 
    status = 'active', 
    is_portal_user = true, 
    portal_access_enabled = true, 
    deactivated = false, 
    company_id = (SELECT id FROM public.companies WHERE LOWER(name) = 'fear of god' LIMIT 1)
WHERE LOWER(email) = 'fearofgod@forgefabric.com';

UPDATE public.profiles
SET customer_name = 'Servade', 
    company_name = 'Servade', 
    role = 'customer', 
    full_name = 'Muhammad Ahmad', 
    status = 'active', 
    is_portal_user = true, 
    portal_access_enabled = true, 
    deactivated = false, 
    company_id = (SELECT id FROM public.companies WHERE LOWER(name) = 'servade' LIMIT 1)
WHERE LOWER(email) = 'ahmad234@gmail.com';

UPDATE public.profiles
SET customer_name = 'UmairCO', 
    company_name = 'UmairCO', 
    role = 'customer', 
    full_name = 'Umair Abbas', 
    status = 'active', 
    is_portal_user = true, 
    portal_access_enabled = true, 
    deactivated = false, 
    company_id = (SELECT id FROM public.companies WHERE LOWER(name) = 'umairco' LIMIT 1)
WHERE LOWER(email) = 'umair.abbas@cybersoftna.com';


-- ==========================================
-- 5. SEED EXACTLY 2 REALISTIC ORDERS PER BRAND
-- ==========================================
DELETE FROM public.orders;

INSERT INTO public.orders (
  order_id, customer_name, po_number, tech_pack_ref, size_breakdown, 
  status, created_date, current_stage, qty, notes, style_no, 
  style_description, color, material_status, delivered_qty, open_balance, delivery_status
) VALUES
-- WIESMADE (2 Orders)
(
  'FF-2026-WM-01', 'WiesMade', 'PO-WM-2026-101', 'TP-WM-SELVEDGE-01', '28-38',
  'In Production', CURRENT_DATE - INTERVAL '14 days', 4, 2400,
  'Japanese 13.5oz Raw Indigo Selvedge Slim Denim Jeans', 'WM-SELVEDGE-01',
  'Raw Indigo Selvedge Slim Jean', 'Indigo Rinse', 'Approved', 0, 2400, 'In Production'
),
(
  'FF-2026-WM-02', 'WiesMade', 'PO-WM-2026-102', 'TP-WM-JKT-03', 'S-XXL',
  'In Production', CURRENT_DATE - INTERVAL '25 days', 8, 1200,
  'Heavyweight 14oz Denim Type III Trucker Jacket', 'WM-JKT-03',
  'Heavyweight Type III Trucker Jacket', 'Vintage Blue', 'Approved', 0, 1200, 'In Production'
),

-- FEAR OF GOD (2 Orders)
(
  'FF-2026-FOG-01', 'Fear of God', 'PO-FOG-2026-081', 'TP-FOG-ESS-DNM', '28-38',
  'In Production', CURRENT_DATE - INTERVAL '10 days', 6, 1800,
  'Relaxed Vintage Wash Denim Jeans with Custom Hardware', 'FOG-ESS-DNM',
  'Relaxed Vintage Wash Denim Jeans', 'Vintage Blue', 'Approved', 0, 1800, 'In Production'
),
(
  'FF-2026-FOG-02', 'Fear of God', 'PO-FOG-2026-082', 'TP-FOG-ESS-JKT', 'S-XXL',
  'In Production', CURRENT_DATE - INTERVAL '30 days', 10, 950,
  'Oversized Denim Overshirt with Laser Whiskers & Ozone Wash', 'FOG-ESS-JKT',
  'Oversized Denim Overshirt', 'Stone Wash', 'Approved', 0, 950, 'In Production'
),

-- SERVADE (2 Orders)
(
  'FF-2026-SRV-01', 'Servade', 'PO-SRV-2026-501', 'TP-SRV-INDIGO-01', '30-40',
  'In Production', CURRENT_DATE - INTERVAL '18 days', 7, 3000,
  '5-Pocket Classic Straight Leg Denim in 12oz Turkish Ring-Spun', 'SRV-INDIGO-01',
  '5-Pocket Classic Straight Leg Jean', 'Mid Blue', 'Approved', 0, 3000, 'In Production'
),
(
  'FF-2026-SRV-02', 'Servade', 'PO-SRV-2026-502', 'TP-SRV-CHINO-02', '30-40',
  'In Production', CURRENT_DATE - INTERVAL '40 days', 12, 1500,
  'Garment Dyed Cotton Twill Chino Pant with Enzyme Softener', 'SRV-CHINO-02',
  'Garment Dyed Twill Chino Pant', 'Ecru', 'Approved', 0, 1500, 'Ready to Ship'
),

-- UMAIRCO (2 Orders)
(
  'FF-2026-UM-01', 'UmairCO', 'PO-UM-2026-301', 'TP-UM-STRETCH-01', '28-38',
  'In Production', CURRENT_DATE - INTERVAL '8 days', 5, 2000,
  'Performance Stretch Comfort Denim Jean with Lycra DualFX', 'UM-STRETCH-01',
  'Performance Stretch Comfort Denim Jean', 'Jet Black', 'Approved', 0, 2000, 'In Production'
),
(
  'FF-2026-UM-02', 'UmairCO', 'PO-UM-2026-302', 'TP-UM-CARGO-02', 'S-XXL',
  'In Production', CURRENT_DATE - INTERVAL '22 days', 9, 1000,
  'Tactical Denim Multi-Pocket Cargo Pant with Enzyme Stone Wash', 'UM-CARGO-02',
  'Tactical Denim Multi-Pocket Cargo', 'Stone Wash', 'Approved', 0, 1000, 'In Production'
);


-- ==========================================
-- 6. SEED PER-PO SKU MAPPINGS
-- ==========================================
DELETE FROM public.sku_mappings;

INSERT INTO public.sku_mappings (
  id, customer_name, brand_name, po_number, customer_sku, factory_code, style_name, colorway, notes
) VALUES
-- WIESMADE
(
  gen_random_uuid(), 'WiesMade', 'WiesMade', 'PO-WM-2026-101', 'WM-RAW-SLM-01', 'FF-DEN-SLIM-SLV', 'Japanese Selvedge Slim Jean', 'Indigo Rinse', 'Primary core run for 13.5oz cone selvedge'
),
(
  gen_random_uuid(), 'WiesMade', 'WiesMade', 'PO-WM-2026-102', 'WM-JKT-TYP3', 'FF-JKT-TRK-HVY', 'Heavyweight Type III Trucker', 'Vintage Blue', '14oz rigid denim trucker jacket'
),

-- FEAR OF GOD
(
  gen_random_uuid(), 'Fear of God', 'Fear of God Essentials', 'PO-FOG-2026-081', 'FOG-ESS-DNM-26', 'FF-DEN-RLX-VNT', 'Relaxed Vintage Wash Denim Jeans', 'Vintage Blue', 'Enzyme stone washed with custom hardware'
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


-- ==========================================
-- 7. SEED & SYNC SAMPLE REQUESTS PIPELINE
-- ==========================================
DELETE FROM public.sample_requests;

INSERT INTO public.sample_requests (
  id, company_id, sample_type, fabric_trim_source, quantity, size_breakdown,
  tech_pack_url, special_instructions, status, created_at
) VALUES
(
  gen_random_uuid(),
  (SELECT id FROM public.companies WHERE LOWER(name) = 'wiesmade' LIMIT 1),
  'Pre-Production',
  'Factory Sourced',
  4,
  '{"30": 1, "32": 2, "34": 1}'::jsonb,
  'https://forgefabric.storage/techpacks/WM-SELVEDGE-01-TP.pdf',
  'Japanese 13.5oz Raw Indigo Selvedge prototype with felled chainstitch seams.',
  'in_production',
  NOW() - INTERVAL '3 days'
),
(
  gen_random_uuid(),
  (SELECT id FROM public.companies WHERE LOWER(name) = 'fear of god' LIMIT 1),
  'Fit',
  'Brand Sourced',
  3,
  '{"S": 1, "M": 1, "L": 1}'::jsonb,
  'https://forgefabric.storage/techpacks/FOG-OVR-SHRT-02-TP.pdf',
  'Relaxed Vintage Wash Denim Overshirt with custom Riri hardware.',
  'submitted',
  NOW() - INTERVAL '1 day'
);


-- ==========================================
-- 8. CLEAN UP SUBMISSIONS (KEEP 4 BRANDS)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_activity_logs') THEN
    DELETE FROM public.apply_activity_logs 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('wiesmade', 'weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_documents') THEN
    DELETE FROM public.apply_documents 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('wiesmade', 'weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_materials') THEN
    DELETE FROM public.apply_materials 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('wiesmade', 'weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_measurements') THEN
    DELETE FROM public.apply_measurements 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('wiesmade', 'weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_line_items') THEN
    DELETE FROM public.apply_line_items 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('wiesmade', 'weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_submissions') THEN
    -- Rename any existing submissions to WiesMade
    UPDATE public.apply_submissions SET company_name = 'WiesMade', brand_name = 'WiesMade' WHERE LOWER(company_name) IN ('weissmade', 'wiesmade');

    DELETE FROM public.apply_submissions 
    WHERE LOWER(company_name) NOT IN ('wiesmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair');
  END IF;
END $$;


-- ==========================================
-- 9. REALTIME WEBSOCKET SUBSCRIPTIONS
-- ==========================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sku_mappings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.apply_submissions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sample_requests;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
