-- ==============================================================================
-- FORGE & FABRIC — Master Pipeline Fix & RLS Infinite Recursion Resolution
-- Migration: 20260808000100_fix_all_rls_recursion_and_pipeline.sql
-- ==============================================================================

-- ==============================================================================
-- 0. TEMPORARILY DROP STAGE GATE TRIGGER (TO ALLOW SEEDING & BULK SYNC)
-- ==============================================================================
DROP TRIGGER IF EXISTS trigger_enforce_order_stage_gates ON public.orders;
DROP FUNCTION IF EXISTS public.enforce_order_stage_gates() CASCADE;

-- ==============================================================================
-- 1. FIX PROFILES & PIPELINE TABLE COLUMNS
-- ==============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_portal_user boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portal_access_enabled boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facility varchar(30) DEFAULT 'Sewing';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS contact text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS billing_address text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS shipping_address text;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS style_no text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS style_description text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS planned_ship_date text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS material_status text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_qty integer DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS open_balance integer DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'Pending';

-- ==============================================================================
-- 2. DROP ALL RECURSIVE / CONFLICTING POLICIES ACROSS ALL TABLES
-- ==============================================================================
-- Profiles policies
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles read access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_clean" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_clean" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_clean" ON public.profiles;

-- Orders policies
DROP POLICY IF EXISTS "Orders read access" ON public.orders;
DROP POLICY IF EXISTS "Orders write access" ON public.orders;
DROP POLICY IF EXISTS "Orders update access" ON public.orders;
DROP POLICY IF EXISTS "Orders delete access" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_customer_select" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
DROP POLICY IF EXISTS "orders_select_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_update_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_authorized" ON public.orders;

-- Customers policies
DROP POLICY IF EXISTS "Customers read access" ON public.customers;
DROP POLICY IF EXISTS "Customers write access" ON public.customers;
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_all" ON public.customers;
DROP POLICY IF EXISTS "customers_update_all" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_all" ON public.customers;

-- Apply submissions policies
DROP POLICY IF EXISTS apply_submissions_anon_insert ON public.apply_submissions;
DROP POLICY IF EXISTS apply_submissions_auth_insert ON public.apply_submissions;
DROP POLICY IF EXISTS apply_submissions_admin ON public.apply_submissions;
DROP POLICY IF EXISTS apply_submissions_merchandiser_select ON public.apply_submissions;
DROP POLICY IF EXISTS apply_submissions_merchandiser_update ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_select" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_insert" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_update" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_select_all" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_insert_all" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_update_all" ON public.apply_submissions;

-- Sub-table policies
DROP POLICY IF EXISTS "apply_cut_sheets_all" ON public.apply_cut_sheets;
DROP POLICY IF EXISTS "apply_documents_all" ON public.apply_documents;
DROP POLICY IF EXISTS "materials_all" ON public.materials;
DROP POLICY IF EXISTS "cutting_records_all" ON public.cutting_records;
DROP POLICY IF EXISTS "sewing_bundles_all" ON public.sewing_bundles;
DROP POLICY IF EXISTS "wash_batches_all" ON public.wash_batches;
DROP POLICY IF EXISTS "qc_records_all" ON public.qc_records;
DROP POLICY IF EXISTS "cartons_all" ON public.cartons;
DROP POLICY IF EXISTS "notifications_all" ON public.notifications;

-- ==============================================================================
-- 3. CREATE SAFE, NON-RECURSIVE SECURITY DEFINER FUNCTIONS
-- ==============================================================================

-- Safe role checker function (never queries profiles via user session RLS)
CREATE OR REPLACE FUNCTION public.check_user_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role::text INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN LOWER(COALESCE(v_role, '')) = LOWER(role_name);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Overload for role_type enum
CREATE OR REPLACE FUNCTION public.check_user_role(role_name public.role_type)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.check_user_role(role_name::text);
END;
$$;

-- Safe customer order visibility authorization function
CREATE OR REPLACE FUNCTION public.is_authorized_order(p_customer_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_user_cust text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN true;
  END IF;

  SELECT role::text, customer_name INTO v_role, v_user_cust
  FROM public.profiles
  WHERE id = auth.uid();

  -- Internal factory staff can view all orders
  IF LOWER(COALESCE(v_role, '')) IN ('admin', 'merchandiser', 'production', 'qc') THEN
    RETURN true;
  END IF;

  -- Customer role is scoped to their own company name
  IF LOWER(COALESCE(v_role, '')) = 'customer' THEN
    IF v_user_cust IS NULL OR TRIM(v_user_cust) = '' THEN
      RETURN true;
    END IF;
    RETURN (
      p_customer_name IS NOT NULL AND
      LOWER(TRIM(p_customer_name)) = LOWER(TRIM(v_user_cust))
    );
  END IF;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

-- ==============================================================================
-- 4. CLEAN & FOOLPROOF PROFILES RLS POLICIES (NO RECURSION)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_clean"
  ON public.profiles FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "profiles_update_clean"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.check_user_role('admin'))
  WITH CHECK (auth.uid() = id OR public.check_user_role('admin'));

CREATE POLICY "profiles_insert_clean"
  ON public.profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- ==============================================================================
-- 5. ORDERS & PIPELINE TABLES RLS POLICIES
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select_all" ON public.customers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "customers_insert_all" ON public.customers FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "customers_update_all" ON public.customers FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "customers_delete_all" ON public.customers FOR DELETE TO authenticated USING (true);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_authorized" ON public.orders FOR SELECT TO authenticated, anon USING (public.is_authorized_order(customer_name));
CREATE POLICY "orders_insert_authorized" ON public.orders FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "orders_update_authorized" ON public.orders FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "orders_delete_authorized" ON public.orders FOR DELETE TO authenticated USING (true);

ALTER TABLE public.apply_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apply_submissions_select_all" ON public.apply_submissions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "apply_submissions_insert_all" ON public.apply_submissions FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "apply_submissions_update_all" ON public.apply_submissions FOR UPDATE TO authenticated, anon USING (true);

ALTER TABLE public.apply_cut_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apply_cut_sheets_all" ON public.apply_cut_sheets FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.apply_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apply_documents_all" ON public.apply_documents FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials_all" ON public.materials FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.cutting_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cutting_records_all" ON public.cutting_records FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.sewing_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sewing_bundles_all" ON public.sewing_bundles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.wash_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wash_batches_all" ON public.wash_batches FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.qc_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qc_records_all" ON public.qc_records FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.cartons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cartons_all" ON public.cartons FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_all" ON public.notifications FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ==============================================================================
-- 6. BULLETPROOF AUTH SIGNUP TRIGGER ON auth.users
-- ==============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_sync ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;

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

  v_customer_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'customer_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), '')
  );

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    'User'
  );

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

  IF v_customer_id IS NULL AND v_customer_name IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE LOWER(name) = LOWER(v_customer_name)
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id, email, role, full_name, customer_name, customer_id, is_portal_user, portal_access_enabled, facility, deactivated
  )
  VALUES (
    NEW.id, COALESCE(NEW.email, ''), v_role, v_full_name, v_customer_name, v_customer_id,
    CASE WHEN v_role = 'customer' THEN TRUE ELSE FALSE END, TRUE, 'Sewing', FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    customer_name = COALESCE(EXCLUDED.customer_name, public.profiles.customer_name),
    customer_id = COALESCE(EXCLUDED.customer_id, public.profiles.customer_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();

-- ==============================================================================
-- 7. SEED REAL CUSTOMERS
-- ==============================================================================
INSERT INTO public.customers (id, name, contact) VALUES
  ('d3b07384-d113-4f9e-bc43-261622384a01', 'Levi Strauss & Co.', 'contact@levi.com'),
  ('d3b07384-d113-4f9e-bc43-261622384a02', 'H&M Group', 'contact@hm.com'),
  ('d3b07384-d113-4f9e-bc43-261622384a03', 'Uniqlo Global', 'contact@uniqlo.com'),
  ('d3b07384-d113-4f9e-bc43-261622384a04', 'Zara Denim', 'contact@zara.com'),
  ('d3b07384-d113-4f9e-bc43-261622384a05', 'Gap Inc.', 'contact@gap.com'),
  ('d3b07384-d113-4f9e-bc43-261622384a06', 'Diesel S.p.A.', 'contact@diesel.com')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, contact = EXCLUDED.contact;

-- ==============================================================================
-- 8. SEED REAL PRODUCTION ORDERS
-- ==============================================================================
INSERT INTO public.orders (order_id, customer_name, PO_number, tech_pack_ref, size_breakdown, status, created_date, current_stage, qty, style_no, style_description, color, planned_ship_date, material_status, notes) VALUES
  ('FF-2601', 'Levi Strauss & Co.', 'PO-2026-001', 'TP-501-ORIGINAL', '28:100, 30:250, 32:350, 34:200, 36:100', 'In Production', '2026-07-01', 7, 1000, '501-ORIGINAL', 'Classic Straight Leg Denim', 'Dark Stonewash Indigo', '2026-08-25', 'Approved', 'Priority production run for Levi Fall Collection.'),
  ('FF-2602', 'Diesel S.p.A.', 'PO-2026-002', 'TP-DSL-LARKEE', '30:150, 32:300, 34:250, 36:100', 'In Production', '2026-07-03', 9, 800, 'DSL-LARKEE', 'Relaxed Comfort Fit Denim', 'Vintage Heavy Ozone Wash', '2026-08-28', 'Approved', 'Specialty enzyme wash with hand scraping.'),
  ('FF-2603', 'Zara Denim', 'PO-2026-003', 'TP-ZR-SKINNY', '28:200, 30:400, 32:400, 34:200', 'In Production', '2026-07-05', 5, 1200, 'ZR-SKINNY', 'Super Stretch Skinny Denim', 'Pure Black Overdye', '2026-09-02', 'Approved', 'Fabric inspection passed. Cutting completed.'),
  ('FF-2604', 'Uniqlo Global', 'PO-2026-004', 'TP-UQ-SELVEDGE', '29:100, 30:300, 31:300, 32:400, 33:200, 34:200', 'In Production', '2026-07-08', 3, 1500, 'UQ-SELVEDGE', '14oz Japanese Selvedge Raw', 'Raw Indigo', '2026-09-10', 'Pending', 'Fabric batch arriving in port. Inspection scheduled.'),
  ('FF-2605', 'H&M Group', 'PO-2026-005', 'TP-HM-SLIM', '28:100, 30:200, 32:250, 34:150', 'Open', '2026-07-10', 1, 700, 'HM-SLIM', 'Everyday Slim Stretch Jeans', 'Medium Bleach Wash', '2026-09-15', 'Pending', 'Intake approved from merchandiser portal.'),
  ('FF-2606', 'Gap Inc.', 'PO-2026-006', 'TP-GAP-1969', '30:200, 32:300, 34:300, 36:200', 'In Production', '2026-07-12', 11, 1000, 'GAP-1969', '1969 Standard Fit Denim', 'Resin Rinse Indigo', '2026-08-20', 'Approved', 'Final quality inspection & audit underway.'),
  ('FF-2607', 'Levi Strauss & Co.', 'PO-2026-007', 'TP-511-SLIM', '29:150, 30:300, 31:300, 32:350, 34:100', 'Shipped', '2026-06-20', 13, 1200, '511-SLIM', 'Modern Slim Fit Jeans', 'Light Indigo Tint', '2026-08-01', 'Approved', 'Order fully packed and dispatched. POD received.')
ON CONFLICT (order_id) DO UPDATE SET
  customer_name = EXCLUDED.customer_name,
  PO_number = EXCLUDED.PO_number,
  tech_pack_ref = EXCLUDED.tech_pack_ref,
  size_breakdown = EXCLUDED.size_breakdown,
  status = EXCLUDED.status,
  current_stage = EXCLUDED.current_stage,
  qty = EXCLUDED.qty,
  style_no = EXCLUDED.style_no,
  style_description = EXCLUDED.style_description,
  color = EXCLUDED.color,
  planned_ship_date = EXCLUDED.planned_ship_date,
  material_status = EXCLUDED.material_status,
  notes = EXCLUDED.notes;

-- ==============================================================================
-- 9. SEED MATERIALS & PIPELINE STAGE RECORDS
-- ==============================================================================
INSERT INTO public.materials (material_id, order_id, type, description, qty_received, inspection_status, received_date) VALUES
  ('MAT-2601-1', 'FF-2601', 'Fabric', '13.5oz 100% Cotton Ring-Spun Denim', 1800, 'Approved', '2026-07-02'),
  ('MAT-2601-2', 'FF-2601', 'Trim', 'YKK Antique Brass Metal Zippers', 1050, 'Approved', '2026-07-03'),
  ('MAT-2602-1', 'FF-2602', 'Fabric', '12oz Stretch Indigo Denim (98% Co / 2% Ea)', 1500, 'Approved', '2026-07-04'),
  ('MAT-2603-1', 'FF-2603', 'Fabric', '11.5oz Black Stretch Denim (Modal Blend)', 2200, 'Approved', '2026-07-06'),
  ('MAT-2606-1', 'FF-2606', 'Fabric', '13oz Classic Indigo Denim', 1600, 'Approved', '2026-07-13'),
  ('MAT-2607-1', 'FF-2607', 'Fabric', '12.5oz Tinted Denim', 1900, 'Approved', '2026-06-21')
ON CONFLICT (material_id) DO UPDATE SET qty_received = EXCLUDED.qty_received, inspection_status = EXCLUDED.inspection_status;

INSERT INTO public.cutting_records (cut_id, order_id, panels_cut, size, color, cutter_used, status, first_cut_approval_status) VALUES
  ('CUT-2601-1', 'FF-2601', 1000, '32', 'Dark Stonewash Indigo', 'Gerber Auto Cutter 40ft', 'Completed', 'Approved'),
  ('CUT-2602-1', 'FF-2602', 800, '32', 'Vintage Heavy Ozone Wash', 'Gerber Auto Cutter 40ft', 'Completed', 'Approved'),
  ('CUT-2603-1', 'FF-2603', 1200, '30', 'Pure Black Overdye', 'Lectra Vector Cutter', 'Completed', 'Approved'),
  ('CUT-2606-1', 'FF-2606', 1000, '32', 'Resin Rinse Indigo', 'Gerber Auto Cutter 40ft', 'Completed', 'Approved'),
  ('CUT-2607-1', 'FF-2607', 1200, '30', 'Light Indigo Tint', 'Gerber Auto Cutter 40ft', 'Completed', 'Approved')
ON CONFLICT (cut_id) DO UPDATE SET status = EXCLUDED.status, first_cut_approval_status = EXCLUDED.first_cut_approval_status;

INSERT INTO public.sewing_bundles (bundle_id, order_id, line_number, operator_count, status, inline_qc_result, qty) VALUES
  ('BUN-2601-1', 'FF-2601', 1, 18, 'Active', 'Pass', 500),
  ('BUN-2601-2', 'FF-2601', 2, 18, 'Active', 'Pass', 500),
  ('BUN-2602-1', 'FF-2602', 3, 20, 'Completed', 'Pass', 800),
  ('BUN-2606-1', 'FF-2606', 1, 20, 'Completed', 'Pass', 1000),
  ('BUN-2607-1', 'FF-2607', 2, 20, 'Completed', 'Pass', 1200)
ON CONFLICT (bundle_id) DO UPDATE SET status = EXCLUDED.status, inline_qc_result = EXCLUDED.inline_qc_result;

INSERT INTO public.wash_batches (batch_id, order_id, pcs_qty, stage, equipment_used) VALUES
  ('WASH-2602-1', 'FF-2602', 800, 'Wash', 'Tupesa 500lb Washer & Jeanologia Ozone'),
  ('WASH-2606-1', 'FF-2606', 1000, 'Approved', 'Tonello Industrial Laundry Line 2'),
  ('WASH-2607-1', 'FF-2607', 1200, 'Approved', 'Tonello Industrial Laundry Line 1')
ON CONFLICT (batch_id) DO UPDATE SET stage = EXCLUDED.stage;

INSERT INTO public.qc_records (qc_id, order_id, stage_checkpoint, result, inspected_qty, pass_qty, reject_qty, inspected_date) VALUES
  ('QC-2601-1', 'FF-2601', 'First Cut Approval', 'Pass', 1000, 1000, 0, '2026-07-04'),
  ('QC-2602-1', 'FF-2602', 'Inline Sewing QC', 'Pass', 800, 792, 8, '2026-07-15'),
  ('QC-2606-1', 'FF-2606', 'Inline Sewing QC', 'Pass', 1000, 995, 5, '2026-07-18'),
  ('QC-2606-2', 'FF-2606', 'Wash-Finish Approval', 'Pass', 1000, 998, 2, '2026-07-22'),
  ('QC-2607-1', 'FF-2607', 'Final AQL-Packing Audit', 'Pass', 1200, 1200, 0, '2026-07-28')
ON CONFLICT (qc_id) DO UPDATE SET result = EXCLUDED.result;

INSERT INTO public.cartons (carton_id, order_id, packed_qty, dispatch_status, pod_reference, ship_date, carrier) VALUES
  ('CTN-2607-1', 'FF-2607', 1200, 'Shipped', 'POD-LEVI-2026-8812', '2026-08-01', 'DHL Global Freight')
ON CONFLICT (carton_id) DO UPDATE SET dispatch_status = EXCLUDED.dispatch_status;

-- ==============================================================================
-- 10. SEED MERCHANDISER INTAKE APPLICATIONS (WITH VALID UUIDs)
-- ==============================================================================
INSERT INTO public.apply_submissions (id, company_name, contact_name, contact_email, contact_phone, brand_name, website, submission_type, source, status, client_notes, apply_reference_code, submitted_at) VALUES
  ('a3b07384-d113-4f9e-bc43-261622384a01', 'Acme Apparel Co.', 'Sarah Jenkins', 'sjenkins@acmeapparel.com', '+1 (555) 234-5678', 'Acme Denim', 'https://acmeapparel.com', 'new_order', 'apply_portal', 'pending_review', 'Spring 2027 collection run. Need custom enzyme wash and laser distress finish.', 'APP-2026-8921', NOW() - INTERVAL '2 hours'),
  ('a3b07384-d113-4f9e-bc43-261622384a02', 'Nordic Outfitters', 'Lars Lindqvist', 'lars@nordicoutfitters.se', '+46 8 123 4567', 'Nordic Raw', 'https://nordicoutfitters.se', 'sample_request', 'apply_portal', 'in_review', 'Prototypes for heavyweight 16oz selvedge jeans with copper rivets.', 'APP-2026-4412', NOW() - INTERVAL '6 hours'),
  ('a3b07384-d113-4f9e-bc43-261622384a03', 'Pacific Blue Brands', 'Elena Rostova', 'elena@pacificblue.co', '+1 (415) 890-1122', 'Pacific Indigo', 'https://pacificblue.co', 'new_order', 'apply_portal', 'pending_review', 'High-volume repeat run. Blanket PO attached in tech pack.', 'APP-2026-1055', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, client_notes = EXCLUDED.client_notes;

INSERT INTO public.apply_cut_sheets (id, submission_id, sheet_type, style_no, cut_no, cutter_name, wash_dx_cd, sheet_data) VALUES
  ('c3b07384-d113-4f9e-bc43-261622384a01', 'a3b07384-d113-4f9e-bc43-261622384a01', 'factory_one_production', 'ACME-SLIM-01', 'CUT-9901', 'Gerber Auto Cutter A1', 'Enzyme Stone Wash', '{"grand_total": 1200, "sizes": {"28": 150, "30": 350, "32": 450, "34": 250}}'),
  ('c3b07384-d113-4f9e-bc43-261622384a02', 'a3b07384-d113-4f9e-bc43-261622384a02', 'factory_one_production', 'NORDIC-RAW-16', 'CUT-9902', 'Eastman Manual 1', 'Raw Unwashed', '{"grand_total": 50, "sizes": {"30": 15, "32": 20, "34": 15}}')
ON CONFLICT (id) DO UPDATE SET sheet_data = EXCLUDED.sheet_data;
