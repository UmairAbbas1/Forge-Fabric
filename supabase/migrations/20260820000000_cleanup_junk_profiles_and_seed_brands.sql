-- ==============================================================================
-- FORGE & FABRIC INDUSTRIES, INC. — PROFILES CLEANUP & BRAND REGISTRATION
-- Removes joke/test accounts ('billa', 'cat', 'meow', 'panda', dummy companies)
-- Preserves professional accounts ('Ahmad234@gmail.com', 'customer@forgefabric.com', 'Thingspk', etc.)
-- Registers & ensures active status for 'Weissmade' and 'Fear of God'
-- ==============================================================================

-- 1. ENSURE UNIQUE CONSTRAINT ON PROFILES EMAIL (SAFELY)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key'
  ) THEN
    -- In case there are duplicates, create unique index
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles(LOWER(email));
  END IF;
END $$;

-- 2. ENABLE FULL DELETE AND UPDATE ON PROFILES
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_delete_clean" ON public.profiles;
CREATE POLICY "profiles_delete_clean" ON public.profiles FOR DELETE TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "profiles_all_full_access" ON public.profiles;
CREATE POLICY "profiles_all_full_access" ON public.profiles FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 3. DELETE DUMMY ORDERS & TEST SUBMISSIONS
-- 3. DELETE DUMMY ORDERS & TEST SUBMISSIONS (SAFELY WITH TABLE CHECKS)
DO $$
BEGIN
  -- Delete orders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DELETE FROM public.orders 
    WHERE LOWER(customer_name) IN (
      'meow', 'meow meow', 'meowsol', 'meowsolutions', 'iwmswsws', 'test brand', 
      'ahmedsol', 'ahmedsolutions', 'ahmed12', 'ahmed', 'alnasser', 'neelam', 
      'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 
      'mycompany', 'bigcompany', 'smallcompany', 'midcompany', 'low company', 
      'testingcompany', 'testingco', 'umairtest', 'umairtest1', 'umairco'
    );
  END IF;

  -- Delete child intake activity logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_activity_logs') THEN
    DELETE FROM public.apply_activity_logs 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) IN ('meow', 'iwmswsws', 'ahmedsolutions', 'ahmedsol', 'ahmed12', 'ahmed', 'ahmed ', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 'testingcompany', 'testingco', 'umairco', 'umairai', 'umairtest', 'umairtest1')
         OR LOWER(brand_name) IN ('meow', 'meowsol', 'ahmedsolutions', 'ahmedsol', 'umairtest1', 'ahmedco', 'neelam')
    );
  END IF;

  -- Delete child intake documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_documents') THEN
    DELETE FROM public.apply_documents 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) IN ('meow', 'iwmswsws', 'ahmedsolutions', 'ahmedsol', 'ahmed12', 'ahmed', 'ahmed ', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 'testingcompany', 'testingco', 'umairco', 'umairai', 'umairtest', 'umairtest1')
         OR LOWER(brand_name) IN ('meow', 'meowsol', 'ahmedsolutions', 'ahmedsol', 'umairtest1', 'ahmedco', 'neelam')
    );
  END IF;

  -- Delete child intake materials
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_materials') THEN
    DELETE FROM public.apply_materials 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) IN ('meow', 'iwmswsws', 'ahmedsolutions', 'ahmedsol', 'ahmed12', 'ahmed', 'ahmed ', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 'testingcompany', 'testingco', 'umairco', 'umairai', 'umairtest', 'umairtest1')
         OR LOWER(brand_name) IN ('meow', 'meowsol', 'ahmedsolutions', 'ahmedsol', 'umairtest1', 'ahmedco', 'neelam')
    );
  END IF;

  -- Delete child intake measurements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_measurements') THEN
    DELETE FROM public.apply_measurements 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) IN ('meow', 'iwmswsws', 'ahmedsolutions', 'ahmedsol', 'ahmed12', 'ahmed', 'ahmed ', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 'testingcompany', 'testingco', 'umairco', 'umairai', 'umairtest', 'umairtest1')
         OR LOWER(brand_name) IN ('meow', 'meowsol', 'ahmedsolutions', 'ahmedsol', 'umairtest1', 'ahmedco', 'neelam')
    );
  END IF;

  -- Delete child intake line items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_line_items') THEN
    DELETE FROM public.apply_line_items 
    WHERE submission_id IN (
      SELECT id FROM public.apply_submissions 
      WHERE LOWER(company_name) IN ('meow', 'iwmswsws', 'ahmedsolutions', 'ahmedsol', 'ahmed12', 'ahmed', 'ahmed ', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 'testingcompany', 'testingco', 'umairco', 'umairai', 'umairtest', 'umairtest1')
         OR LOWER(brand_name) IN ('meow', 'meowsol', 'ahmedsolutions', 'ahmedsol', 'umairtest1', 'ahmedco', 'neelam')
    );
  END IF;

  -- Delete parent apply_submissions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'apply_submissions') THEN
    DELETE FROM public.apply_submissions 
    WHERE LOWER(company_name) IN ('meow', 'iwmswsws', 'ahmedsolutions', 'ahmedsol', 'ahmed12', 'ahmed', 'ahmed ', 'neelam', 'billa', 'billaai', 'billacompany', 'billahouse', 'happyai', 'panda', 'testingcompany', 'testingco', 'umairco', 'umairai', 'umairtest', 'umairtest1')
       OR LOWER(brand_name) IN ('meow', 'meowsol', 'ahmedsolutions', 'ahmedsol', 'umairtest1', 'ahmedco', 'neelam');
  END IF;

  -- Delete packing_lists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'packing_lists') THEN
    DELETE FROM public.packing_lists
    WHERE LOWER(customer_name) IN (
      'meow', 'meow meow', 'meowsol', 'iwmswsws', 'test brand', 'ahmedsol', 'ahmedsolutions', 
      'billaai', 'billacompany', 'billahouse', 'meowsolutions', 'happyai', 'panda', 
      'mycompany', 'bigcompany', 'smallcompany', 'midcompany', 'low company', 
      'testingcompany', 'testingco', 'umairtest', 'umairtest1', 'umairco'
    );
  END IF;
END $$;

-- 4. PERMANENTLY REMOVE DUMMY / JUNK PROFILE ACCOUNTS
DELETE FROM public.profiles 
WHERE LOWER(email) IN (
  'billa@gmail.com',
  'billa123@gmail.com',
  'billa2@gmail.com',
  'testing123@gmail.com',
  'meow@gmail.com',
  'happycat@gmail.com',
  'panda@gmail.com',
  'test_1784892553022@forgefabric.com',
  'faizijaz917@gmail.com',
  'faizijaz918@gmail.com',
  'faizijaz919@gmail.com',
  'faizijaz920@gmail.com',
  'faizijaz921@gmail.com',
  'testing@gmail.com',
  'testing21@gmail.com',
  'uamirtesting@gmail.com',
  'umairtesting@gmail.com'
)
OR LOWER(customer_name) IN (
  'billaai', 'billacompany', 'billahouse', 'meowsolutions', 'happyai', 'panda', 
  'mycompany', 'bigcompany', 'smallcompany', 'midcompany', 'low company', 
  'testingcompany', 'testingco', 'umairtest', 'umairtest1'
);

-- 5. ENSURE OFFICIAL CUSTOMER COMPANIES & PROFILES EXIST & ARE ACTIVE
-- Servade (Ahmad234@gmail.com)
UPDATE public.profiles
SET 
  customer_name = 'Servade',
  role = 'customer',
  full_name = 'Muhammad Ahmad',
  status = 'active',
  is_portal_user = true,
  portal_access_enabled = true,
  deactivated = false
WHERE LOWER(email) = 'ahmad234@gmail.com';

-- Levi Strauss & Co. (customer@forgefabric.com & faizijaz914@gmail.com)
UPDATE public.profiles
SET 
  customer_name = 'Levi Strauss & Co.',
  role = 'customer',
  full_name = 'Levi Strauss Operations',
  status = 'active',
  is_portal_user = true,
  portal_access_enabled = true,
  deactivated = false
WHERE LOWER(email) IN ('customer@forgefabric.com', 'faizijaz914@gmail.com');

-- Thingspk (thingspk10@gmail.com & faizijaz916@gmail.com)
UPDATE public.profiles
SET 
  customer_name = 'Thingspk',
  role = 'customer',
  status = 'active',
  is_portal_user = true,
  portal_access_enabled = true,
  deactivated = false
WHERE LOWER(email) IN ('thingspk10@gmail.com', 'faizijaz916@gmail.com', 'faizijaz915@gmail.com');

-- Weissmade (weissmade@forgefabric.com)
INSERT INTO public.profiles (id, email, full_name, role, customer_name, status, is_portal_user, portal_access_enabled, deactivated, facility_scope)
SELECT 
  '9b59d56b-04d0-44da-a729-9e84f40a3473',
  'weissmade@forgefabric.com',
  'Weissmade Brand Representative',
  'customer',
  'Weissmade',
  'active',
  true,
  true,
  false,
  'All'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = 'weissmade@forgefabric.com');

UPDATE public.profiles
SET 
  customer_name = 'Weissmade',
  role = 'customer',
  full_name = 'Weissmade Brand Representative',
  status = 'active',
  is_portal_user = true,
  portal_access_enabled = true,
  deactivated = false
WHERE LOWER(email) = 'weissmade@forgefabric.com';

-- Fear of God (fearofgod@forgefabric.com)
INSERT INTO public.profiles (id, email, full_name, role, customer_name, status, is_portal_user, portal_access_enabled, deactivated, facility_scope)
SELECT 
  gen_random_uuid(),
  'fearofgod@forgefabric.com',
  'Fear of God Brand Representative',
  'customer',
  'Fear of God',
  'active',
  true,
  true,
  false,
  'All'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = 'fearofgod@forgefabric.com');

UPDATE public.profiles
SET 
  customer_name = 'Fear of God',
  role = 'customer',
  full_name = 'Fear of God Brand Representative',
  status = 'active',
  is_portal_user = true,
  portal_access_enabled = true,
  deactivated = false
WHERE LOWER(email) = 'fearofgod@forgefabric.com';

-- 6. REALTIME PUBLICATION REFRESH
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
