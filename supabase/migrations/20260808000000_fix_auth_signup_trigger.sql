-- ==============================================================================
-- FORGE & FABRIC — Comprehensive Auth & Profile Trigger Fix Migration
-- Migration: 20260808000000_fix_auth_signup_trigger.sql
-- ==============================================================================

-- 1. Ensure required columns on public.profiles exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_portal_user boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portal_access_enabled boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facility varchar(30) DEFAULT 'Sewing';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. Drop all conflicting old triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_sync ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
DROP TRIGGER IF EXISTS tr_auth_user_created ON auth.users;

-- 3. Drop legacy trigger functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_sync() CASCADE;

-- 4. Create bulletproof trigger function with safe error handling
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role public.role_type := 'customer'::public.role_type;
  v_role_str text;
  v_customer_name text;
  v_full_name text;
  v_customer_id uuid := NULL;
  v_cid_str text;
BEGIN
  -- Safely extract and normalize role
  BEGIN
    v_role_str := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', 'customer')));
    IF v_role_str IN ('admin', 'merchandiser', 'production', 'qc', 'customer') THEN
      v_role := v_role_str::public.role_type;
    ELSE
      v_role := 'customer'::public.role_type;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'customer'::public.role_type;
  END;

  -- Safely extract customer name and full name
  v_customer_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'customer_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), '')
  );

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    'User'
  );

  -- Safely extract and validate customer_id FK only if UUID exists in customers table
  BEGIN
    v_cid_str := NULLIF(TRIM(NEW.raw_user_meta_data->>'customer_id'), '');
    IF v_cid_str IS NOT NULL AND v_cid_str ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      IF EXISTS (SELECT 1 FROM public.customers WHERE id = v_cid_str::uuid) THEN
        v_customer_id := v_cid_str::uuid;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_customer_id := NULL;
  END;

  -- Auto-link by customer_name if customer_id was not explicitly provided
  IF v_customer_id IS NULL AND v_customer_name IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE LOWER(name) = LOWER(v_customer_name)
    LIMIT 1;
  END IF;

  -- Insert or update public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name,
    customer_name,
    customer_id,
    is_portal_user,
    portal_access_enabled,
    facility,
    deactivated
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_role,
    v_full_name,
    v_customer_name,
    v_customer_id,
    CASE WHEN v_role = 'customer' THEN TRUE ELSE FALSE END,
    TRUE,
    'Sewing',
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    customer_name = COALESCE(EXCLUDED.customer_name, public.profiles.customer_name),
    customer_id = COALESCE(EXCLUDED.customer_id, public.profiles.customer_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never crash auth.users insert transaction; log warning and continue
  RAISE WARNING 'handle_auth_user_created error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 5. Attach the single authoritative trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();

-- 6. Ensure RLS policies on public.profiles allow proper user access
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles read access" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role insert profiles" ON public.profiles;

CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'merchandiser', 'production', 'qc')
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 7. Backfill any existing auth.users into public.profiles
INSERT INTO public.profiles (id, email, role, full_name, customer_name, is_portal_user, portal_access_enabled, facility)
SELECT
  u.id,
  COALESCE(u.email, ''),
  CASE 
    WHEN LOWER(COALESCE(u.raw_user_meta_data->>'role', 'customer')) IN ('admin', 'merchandiser', 'production', 'qc', 'customer')
      THEN (LOWER(COALESCE(u.raw_user_meta_data->>'role', 'customer')))::public.role_type
    ELSE 'customer'::public.role_type
  END,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'User'),
  COALESCE(u.raw_user_meta_data->>'customer_name', u.raw_user_meta_data->>'company_name', NULL),
  TRUE,
  TRUE,
  'Sewing'
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
  customer_name = COALESCE(public.profiles.customer_name, EXCLUDED.customer_name);
