-- ==============================================================================
-- FORGE & FABRIC INDUSTRIES, INC. — STRICT 4-BRAND MES CLEANUP & SEEDING
-- Brands Preserved & Configured:
-- 1. Weissmade (weissmade@forgefabric.com)
-- 2. Fear of God (fearofgod@forgefabric.com)
-- 3. Servade (Ahmad234@gmail.com)
-- 4. UmairCO (umair.abbas@cybersoftna.com)
-- ==============================================================================

-- 1. ENABLE FULL ACCESS & POLICIES
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_all_full_access" ON public.orders;
CREATE POLICY "orders_all_full_access" ON public.orders FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.apply_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apply_submissions_all_full_access" ON public.apply_submissions;
CREATE POLICY "apply_submissions_all_full_access" ON public.apply_submissions FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_all_full_access" ON public.profiles;
CREATE POLICY "profiles_all_full_access" ON public.profiles FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 2. WIPE ALL OLD ORDERS & SEED EXACTLY 2 REALISTIC ORDERS PER BRAND
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DELETE FROM public.orders;
    
    INSERT INTO public.orders (
      order_id, customer_name, po_number, tech_pack_ref, size_breakdown, 
      status, created_date, current_stage, qty, notes, style_no, 
      style_description, color, material_status, delivered_qty, open_balance, delivery_status
    ) VALUES
    -- WEISSMADE (2 Orders)
    (
      'FF-2026-WM-01', 'Weissmade', 'PO-WM-2026-101', 'TP-WM-SELVEDGE-01', '28-38',
      'In Production', CURRENT_DATE - INTERVAL '14 days', 4, 2400,
      'Japanese 13.5oz Raw Indigo Selvedge Slim Denim Jeans', 'WM-SELVEDGE-01',
      'Raw Indigo Selvedge Slim Jean', 'Indigo Rinse', 'Approved', 0, 2400, 'In Production'
    ),
    (
      'FF-2026-WM-02', 'Weissmade', 'PO-WM-2026-102', 'TP-WM-JKT-03', 'S-XXL',
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
  END IF;
END $$;

-- 3. PURGE UNRELATED SUBMISSIONS AND KEEP ONLY 4 BRANDS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_activity_logs') THEN
    DELETE FROM public.apply_activity_logs 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_documents') THEN
    DELETE FROM public.apply_documents 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_materials') THEN
    DELETE FROM public.apply_materials 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_measurements') THEN
    DELETE FROM public.apply_measurements 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_line_items') THEN
    DELETE FROM public.apply_line_items 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) NOT IN ('weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair')
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_submissions') THEN
    DELETE FROM public.apply_submissions 
    WHERE LOWER(company_name) NOT IN ('weissmade', 'fear of god', 'servade', 'umairco', 'umairai', 'umair');
  END IF;
END $$;

-- 4. PURGE UNRELATED CUSTOMER PROFILES AND LOCK THE 4 OFFICIAL BRANDS
DELETE FROM public.profiles 
WHERE role = 'customer' 
  AND LOWER(email) NOT IN (
    'weissmade@forgefabric.com',
    'fearofgod@forgefabric.com',
    'ahmad234@gmail.com',
    'umair.abbas@cybersoftna.com'
  );

-- Update and ensure active state for the 4 official customer profiles
UPDATE public.profiles
SET customer_name = 'Weissmade', role = 'customer', full_name = 'Weissmade Brand Representative', status = 'active', is_portal_user = true, portal_access_enabled = true, deactivated = false
WHERE LOWER(email) = 'weissmade@forgefabric.com';

UPDATE public.profiles
SET customer_name = 'Fear of God', role = 'customer', full_name = 'Fear of God Brand Representative', status = 'active', is_portal_user = true, portal_access_enabled = true, deactivated = false
WHERE LOWER(email) = 'fearofgod@forgefabric.com';

UPDATE public.profiles
SET customer_name = 'Servade', role = 'customer', full_name = 'Muhammad Ahmad', status = 'active', is_portal_user = true, portal_access_enabled = true, deactivated = false
WHERE LOWER(email) = 'ahmad234@gmail.com';

UPDATE public.profiles
SET customer_name = 'UmairCO', role = 'customer', full_name = 'Umair Abbas', status = 'active', is_portal_user = true, portal_access_enabled = true, deactivated = false
WHERE LOWER(email) = 'umair.abbas@cybersoftna.com';

-- 5. REALTIME PUBLICATION REFRESH
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.apply_submissions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
