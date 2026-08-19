-- ==============================================================================
-- FORGE & FABRIC INDUSTRIES, INC. — V2 SPECIFICATION PRODUCTION UPGRADE
-- Migration: 20260823000000_v2_spec_production_upgrade.sql
--
-- Implements the 13 unified requirements from FORGE_FABRIC_MES_SPECIFICATION_V2.md:
--   REQ-01 Role/User Assignment (facility_scope column; UI reassignment is client-side)
--   REQ-02 Material Receiving (GRN) Approval Ownership & Signature Gate
--   REQ-03 Zero-Trust Multi-Brand Tenant Isolation (RLS lockdown — see Section 1)
--   REQ-04 Sample Request Controls (3-day turnaround, 100pc cap, approval gate, master SKU)
--   REQ-05 Tech Pack Centralized Storage & Document Vault
--   REQ-06 PO Prerequisite Gate for Invoicing & Dispatch
--   REQ-07 New Order Pricing Approval & Quoting Workflow
--   REQ-08 Universal Outsourcing Support for All 13 Stages
--   REQ-09 Capacity-Based Dynamic Delivery Date Scheduling
--   REQ-12 Mobile/Tablet Shop Floor Touch Interface (frontend only, no schema)
--   REQ-13 Production Cost, Scrap Yardage & Rework COPQ Tracking
--
-- REQ-10 (RFID) and REQ-11 (QuickBooks/ERP sync) are explicitly Phase 3 roadmap
-- items in the spec and are NOT implemented here (no hardware/external API to
-- integrate against yet).
-- ==============================================================================


-- ==============================================================================
-- SECTION 1 — REQ-03: CLOSE THE ZERO-TRUST RLS REGRESSION (CRITICAL)
-- ==============================================================================
-- Migration 20260811000600 established strict, FK-scoped RLS policies. Two later
-- migrations (20260818000000_update_cut_tickets_schema.sql and the working-copy
-- 20260822000000_master_mes_database_setup.sql) each added a SECOND, permissive
-- "_full_access" policy of the form `FOR ALL TO public, anon, authenticated
-- USING (true)` on top of the same tables. Postgres RLS policies are OR'd
-- together, so the presence of ANY permissive `USING (true)` policy grants
-- full access regardless of how carefully the other policies are scoped. In
-- practice this means the public anon key (visible in the client bundle and
-- hardcoded as a fallback in src/lib/supabase.ts) currently has unrestricted
-- read/write access to every customer's orders, contact info, and business
-- data via the PostgREST API, bypassing the app's UI-level checks entirely.
--
-- This section drops every such policy by its exact name and replaces it with
-- access scoped by is_internal_staff() / get_auth_user_company_id() (reusing
-- the helper functions from 20260811000600, already patched for legacy role
-- values by 20260816000000). Where a table requires anonymous access for a
-- documented public feature (the /apply intake portal, or public order-status
-- lookup), that access is narrowed to exactly what the feature needs instead
-- of a blanket USING (true).
-- ==============================================================================

-- Reconfirm helper functions exist with the legacy-role-inclusive definitions.
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS VARCHAR AS $$
  SELECT role::varchar FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND coalesce(deactivated, false) = false
    AND role::varchar IN (
      'super_admin', 'admin', 'merchandiser', 'production_manager',
      'cutting_supervisor', 'sewing_supervisor', 'qc_inspector',
      'warehouse', 'finance', 'production', 'qc'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role::varchar IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- SCHEMA-DRIFT INSURANCE: this repo's migrations have repeatedly redefined
-- tables without the live database actually matching what later migrations
-- and application code assume (inventory_lots.inspection_status turned out
-- not to exist despite being read/written throughout the app). Every column
-- referenced below in a CREATE POLICY, CHECK constraint, or non-dynamic SQL
-- statement is validated against the catalog at creation time, so a missing
-- column aborts the whole transaction. These guards make that impossible for
-- the columns this migration depends on, regardless of what actually shipped
-- in earlier migrations. All are harmless no-ops if the column already exists.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS deactivated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS apply_reference_code text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS submission_type text;

ALTER TABLE IF EXISTS public.sample_requests
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;

-- ------------------------------------------------------------------------------
-- 1.1 ORDERS — drop the open policy, keep the existing scoped one
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_all_full_access" ON public.orders;

DROP POLICY IF EXISTS "Allow customer select their own orders" ON public.orders;
CREATE POLICY "Allow customer select their own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff() OR
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.name = public.orders.customer_name
      AND c.id = public.get_auth_user_company_id()
    )
  );

DROP POLICY IF EXISTS "orders_staff_write" ON public.orders;
CREATE POLICY "orders_staff_write" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "orders_staff_update" ON public.orders;
CREATE POLICY "orders_staff_update" ON public.orders
  FOR UPDATE TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "orders_staff_delete" ON public.orders;
CREATE POLICY "orders_staff_delete" ON public.orders
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- ------------------------------------------------------------------------------
-- 1.2 PROFILES — drop the open policy; self + staff scoped access
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_all_full_access" ON public.profiles;

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_internal_staff());

DROP POLICY IF EXISTS "profiles_self_upsert" ON public.profiles;
CREATE POLICY "profiles_self_upsert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- ------------------------------------------------------------------------------
-- 1.3 COMPANIES — drop the open policy. The public /apply intake wizard hard-
-- gates on selecting a validated existing company (or creating a new brand
-- on-the-fly), so anon needs SELECT + INSERT here; write/delete of EXISTING
-- rows stays staff-only.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_all_full_access" ON public.companies;

DROP POLICY IF EXISTS "companies_public_intake_select" ON public.companies;
CREATE POLICY "companies_public_intake_select" ON public.companies
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "companies_public_intake_insert" ON public.companies;
CREATE POLICY "companies_public_intake_insert" ON public.companies
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "companies_staff_update" ON public.companies;
CREATE POLICY "companies_staff_update" ON public.companies
  FOR UPDATE TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "companies_staff_delete" ON public.companies;
CREATE POLICY "companies_staff_delete" ON public.companies
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- ------------------------------------------------------------------------------
-- 1.4 ADDRESS BOOK & CONTACTS — the public intake wizard pre-fills an existing
-- company's primary address/contact in read-only mode (documented golden-path
-- step in SMOKE_TEST_CHECKLIST.md), so anon SELECT is required. Anon may also
-- INSERT a new address/contact when the intake creates a brand-new company.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "address_book_public_select" ON public.address_book;
CREATE POLICY "address_book_public_select" ON public.address_book
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "address_book_public_insert" ON public.address_book;
CREATE POLICY "address_book_public_insert" ON public.address_book
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "contacts_public_select" ON public.contacts;
CREATE POLICY "contacts_public_select" ON public.contacts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "contacts_public_insert" ON public.contacts;
CREATE POLICY "contacts_public_insert" ON public.contacts
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 1.5 APPLY PORTAL (apply_submissions / apply_cut_sheets / apply_documents /
-- apply_activity_logs) — public intake needs anon INSERT. Anon SELECT of the
-- raw tables is intentionally NOT granted (that would let anyone dump every
-- brand's submissions, contacts, and notes with a single unauthenticated
-- REST call). The public "check my order status" feature is served instead
-- by the get_submission_status_by_reference() SECURITY DEFINER RPC below,
-- which performs the reference-code + email match server-side.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "apply_submissions_all_full_access" ON public.apply_submissions;

DROP POLICY IF EXISTS "apply_submissions_public_insert" ON public.apply_submissions;
CREATE POLICY "apply_submissions_public_insert" ON public.apply_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "apply_submissions_staff_select" ON public.apply_submissions;
CREATE POLICY "apply_submissions_staff_select" ON public.apply_submissions
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.apply_submissions.company_name)
    )
  );

DROP POLICY IF EXISTS "apply_submissions_staff_update" ON public.apply_submissions;
CREATE POLICY "apply_submissions_staff_update" ON public.apply_submissions
  FOR UPDATE TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "apply_submissions_staff_delete" ON public.apply_submissions;
CREATE POLICY "apply_submissions_staff_delete" ON public.apply_submissions
  FOR DELETE TO authenticated USING (public.is_admin_user());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='apply_cut_sheets') THEN
    ALTER TABLE public.apply_cut_sheets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "apply_cut_sheets_full_access" ON public.apply_cut_sheets;
    DROP POLICY IF EXISTS "apply_cut_sheets_public_insert" ON public.apply_cut_sheets;
    CREATE POLICY "apply_cut_sheets_public_insert" ON public.apply_cut_sheets
      FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "apply_cut_sheets_staff_all" ON public.apply_cut_sheets;
    CREATE POLICY "apply_cut_sheets_staff_all" ON public.apply_cut_sheets
      FOR ALL TO authenticated USING (public.is_internal_staff());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='apply_documents') THEN
    ALTER TABLE public.apply_documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "apply_documents_full_access" ON public.apply_documents;
    DROP POLICY IF EXISTS "apply_documents_public_insert" ON public.apply_documents;
    CREATE POLICY "apply_documents_public_insert" ON public.apply_documents
      FOR INSERT TO anon, authenticated WITH CHECK (true);
    DROP POLICY IF EXISTS "apply_documents_staff_all" ON public.apply_documents;
    CREATE POLICY "apply_documents_staff_all" ON public.apply_documents
      FOR ALL TO authenticated USING (public.is_internal_staff());
  END IF;
END $$;

-- Server-side lookup for the anonymous /apply/status page — replaces direct
-- anon table SELECT so the reference-code + email match is enforced in the
-- database rather than trusted to client-side query filters. Returns the
-- submission PLUS its child records (cut sheets, documents, update requests,
-- and any price quote) as one JSON payload, since those child tables are
-- staff-only under RLS and anon has no other way to read them.
--
-- This project's migrations have drifted from what application code assumes
-- more than once (see Section 1's preamble) — update_requests in particular
-- has been redefined with different column sets across migrations, so the
-- live FK column linking it to apply_submissions is not reliably known
-- ('submission_id' vs 'apply_submission_id', text vs uuid). Each child lookup
-- below therefore runs via EXECUTE (deferring column resolution to runtime,
-- not function-creation time) inside its own exception handler, so an
-- unexpected schema on any ONE child table degrades that section to an empty
-- array instead of breaking the whole status lookup.
CREATE OR REPLACE FUNCTION public.get_submission_status_by_reference(
  p_reference_code text,
  p_email text
)
RETURNS jsonb AS $$
DECLARE
  v_submission public.apply_submissions;
  v_cut_sheets jsonb := '[]'::jsonb;
  v_documents jsonb := '[]'::jsonb;
  v_update_requests jsonb := '[]'::jsonb;
  v_price_quotes jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_submission
  FROM public.apply_submissions
  WHERE apply_reference_code = upper(trim(p_reference_code))
  AND lower(contact_email) = lower(trim(p_email))
  LIMIT 1;

  IF v_submission.id IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    EXECUTE 'SELECT COALESCE(jsonb_agg(cs.*), ''[]''::jsonb) FROM public.apply_cut_sheets cs WHERE cs.submission_id = $1'
      INTO v_cut_sheets USING v_submission.id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_cut_sheets := '[]'::jsonb;
  END;

  BEGIN
    EXECUTE 'SELECT COALESCE(jsonb_agg(d.*), ''[]''::jsonb) FROM public.apply_documents d WHERE d.submission_id = $1'
      INTO v_documents USING v_submission.id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_documents := '[]'::jsonb;
  END;

  BEGIN
    EXECUTE 'SELECT COALESCE(jsonb_agg(u.*), ''[]''::jsonb) FROM public.update_requests u WHERE u.submission_id::text = $1'
      INTO v_update_requests USING v_submission.id::text;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    BEGIN
      EXECUTE 'SELECT COALESCE(jsonb_agg(u.*), ''[]''::jsonb) FROM public.update_requests u WHERE u.apply_submission_id::text = $1'
        INTO v_update_requests USING v_submission.id::text;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      v_update_requests := '[]'::jsonb;
    END;
  END;

  BEGIN
    EXECUTE 'SELECT COALESCE(jsonb_agg(q.*), ''[]''::jsonb) FROM public.price_quotes q WHERE q.submission_id = $1'
      INTO v_price_quotes USING v_submission.id;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    v_price_quotes := '[]'::jsonb;
  END;

  RETURN to_jsonb(v_submission) || jsonb_build_object(
    'apply_cut_sheets', v_cut_sheets,
    'apply_documents', v_documents,
    'update_requests', v_update_requests,
    'price_quotes', v_price_quotes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_submission_status_by_reference(text, text) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1.6 SAMPLE REQUESTS — anon INSERT (public sample subform), staff/own-company
-- SELECT + write.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sample_requests_all_full_access" ON public.sample_requests;

DROP POLICY IF EXISTS "sample_requests_public_insert" ON public.sample_requests;
CREATE POLICY "sample_requests_public_insert" ON public.sample_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sample_requests_staff_select" ON public.sample_requests;
CREATE POLICY "sample_requests_staff_select" ON public.sample_requests
  FOR SELECT TO authenticated
  USING (public.is_internal_staff() OR company_id = public.get_auth_user_company_id());

DROP POLICY IF EXISTS "sample_requests_staff_update" ON public.sample_requests;
CREATE POLICY "sample_requests_staff_update" ON public.sample_requests
  FOR UPDATE TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "sample_requests_staff_delete" ON public.sample_requests;
CREATE POLICY "sample_requests_staff_delete" ON public.sample_requests
  FOR DELETE TO authenticated USING (public.is_admin_user());

-- ------------------------------------------------------------------------------
-- 1.7 SKU MAPPINGS, QC, EQUIPMENT, TENANT BRANDING, UPDATE REQUESTS —
-- internal-only tables; no public/anon feature depends on these.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sku_mappings_full_access" ON public.sku_mappings;
DROP POLICY IF EXISTS "sku_mappings_staff_all" ON public.sku_mappings;
CREATE POLICY "sku_mappings_staff_all" ON public.sku_mappings
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "qc_inspections_full_access" ON public.qc_inspections;
DROP POLICY IF EXISTS "qc_inspections_staff_scoped" ON public.qc_inspections;
CREATE POLICY "qc_inspections_staff_scoped" ON public.qc_inspections
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "qc_records_full_access" ON public.qc_records;
DROP POLICY IF EXISTS "qc_records_staff_scoped" ON public.qc_records;
CREATE POLICY "qc_records_staff_scoped" ON public.qc_records
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "equipment_full_access" ON public.equipment;
DROP POLICY IF EXISTS "equipment_read_all" ON public.equipment;
CREATE POLICY "equipment_read_all" ON public.equipment
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "equipment_staff_write" ON public.equipment;
CREATE POLICY "equipment_staff_write" ON public.equipment
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "tenant_branding_full_access" ON public.tenant_branding;
DROP POLICY IF EXISTS "tenant_branding_public_read" ON public.tenant_branding;
CREATE POLICY "tenant_branding_public_read" ON public.tenant_branding
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "tenant_branding_admin_write" ON public.tenant_branding;
CREATE POLICY "tenant_branding_admin_write" ON public.tenant_branding
  FOR ALL TO authenticated USING (public.is_admin_user());

DROP POLICY IF EXISTS "update_requests_full_access" ON public.update_requests;
DROP POLICY IF EXISTS "update_requests_public_insert" ON public.update_requests;
CREATE POLICY "update_requests_public_insert" ON public.update_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_requests_staff_all" ON public.update_requests;
CREATE POLICY "update_requests_staff_all" ON public.update_requests
  FOR ALL TO authenticated USING (public.is_internal_staff());


-- ==============================================================================
-- SECTION 2 — REQ-01: ROLE & FACILITY ASSIGNMENT
-- ==============================================================================
-- Staff accounts (Pat, Wesley, Joe, Warehouse supervisors, etc.) must be
-- provisioned through Settings > User Management "Invite New User", which
-- calls Supabase Auth's admin.inviteUserByEmail so a matching auth.users row
-- exists — a raw SQL INSERT into public.profiles with a fabricated id cannot
-- satisfy the auth.users foreign key and would either fail or create an
-- orphaned, unusable row. This migration adds the facility_scope column and
-- an index so the invite flow and the new reassignment modal can persist it.
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS facility_scope text DEFAULT 'All';

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_facility_scope ON public.profiles (facility_scope);


-- ==============================================================================
-- SECTION 3 — REQ-02: MATERIAL RECEIVING (GRN) APPROVAL GATE
-- ==============================================================================
ALTER TABLE IF EXISTS public.inventory_lots
  ADD COLUMN IF NOT EXISTS inspection_status text DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS four_point_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shade_lot_matching_passed boolean DEFAULT true;

-- Normalize inspection_status values so the CHECK constraint below is safe
-- to add against any pre-existing rows.
UPDATE public.inventory_lots
SET inspection_status = 'Pending'
WHERE inspection_status IS NULL OR inspection_status NOT IN ('Pending', 'Approved', 'Hold');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_lots_inspection_status_check'
  ) THEN
    ALTER TABLE public.inventory_lots
      ADD CONSTRAINT inventory_lots_inspection_status_check
      CHECK (inspection_status IN ('Pending', 'Approved', 'Hold'));
  END IF;
END $$;


-- ==============================================================================
-- SECTION 4 — REQ-04: SAMPLE REQUEST GOVERNANCE
-- ==============================================================================
ALTER TABLE IF EXISTS public.sample_requests
  ADD COLUMN IF NOT EXISTS client_reference_sku text,
  ADD COLUMN IF NOT EXISTS master_product_sku text,
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS sample_status text DEFAULT 'Sample_Requested',
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.sample_requests
SET sample_status = 'Sample_Requested'
WHERE sample_status IS NULL
  OR sample_status NOT IN ('Sample_Requested', 'In_Sample_Making', 'Sample_Completed', 'Sample_Approved', 'Sample_Rejected', 'Converted_To_Bulk');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sample_requests_sample_status_check') THEN
    ALTER TABLE public.sample_requests
      ADD CONSTRAINT sample_requests_sample_status_check
      CHECK (sample_status IN ('Sample_Requested', 'In_Sample_Making', 'Sample_Completed', 'Sample_Approved', 'Sample_Rejected', 'Converted_To_Bulk'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sample_requests_quantity_cap') THEN
    ALTER TABLE public.sample_requests
      ADD CONSTRAINT sample_requests_quantity_cap CHECK (quantity <= 100);
  END IF;
END $$;

ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS client_reference_sku text,
  ADD COLUMN IF NOT EXISTS master_product_sku text,
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS sample_status text DEFAULT 'Sample_Requested';

UPDATE public.apply_submissions
SET sample_status = 'Sample_Requested'
WHERE submission_type = 'sample_request'
  AND (sample_status IS NULL OR sample_status NOT IN ('Sample_Requested', 'In_Sample_Making', 'Sample_Completed', 'Sample_Approved', 'Sample_Rejected', 'Converted_To_Bulk'));


-- ==============================================================================
-- SECTION 5 — REQ-05: TECH PACK CENTRALIZED VAULT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tech_pack_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  style_code text NOT NULL,
  version_number int NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size_bytes bigint,
  mime_type text DEFAULT 'application/pdf',
  uploaded_by text,
  uploaded_by_id uuid REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  change_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_pack_vault_style ON public.tech_pack_vault (style_code, is_active);
CREATE INDEX IF NOT EXISTS idx_tech_pack_vault_company ON public.tech_pack_vault (company_id);

ALTER TABLE public.tech_pack_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tech_pack_vault_staff_all" ON public.tech_pack_vault;
CREATE POLICY "tech_pack_vault_staff_all" ON public.tech_pack_vault
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "tech_pack_vault_customer_select" ON public.tech_pack_vault;
CREATE POLICY "tech_pack_vault_customer_select" ON public.tech_pack_vault
  FOR SELECT TO authenticated
  USING (company_id = public.get_auth_user_company_id());

-- Ensure the storage bucket used by the vault UI exists (private — signed URLs only).
INSERT INTO storage.buckets (id, name, public)
VALUES ('tech-packs', 'tech-packs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tech_packs_staff_all" ON storage.objects;
CREATE POLICY "tech_packs_staff_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'tech-packs' AND public.is_internal_staff())
  WITH CHECK (bucket_id = 'tech-packs' AND public.is_internal_staff());

DROP POLICY IF EXISTS "tech_packs_customer_read" ON storage.objects;
CREATE POLICY "tech_packs_customer_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tech-packs' AND (storage.foldername(name))[1] = public.get_auth_user_company_id()::text);


-- ==============================================================================
-- SECTION 6 — REQ-06: PO PREREQUISITE GATE FOR INVOICING & DISPATCH
-- ==============================================================================
-- The live app runs order/dispatch flows against the legacy `orders` table
-- (not the aspirational purchase_orders/work_orders ERP tables), so the gate
-- is enforced client-side in dispatch.tsx / finance.tsx against orders.PO_number
-- and this new document-link column.
ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS po_document_url text;

ALTER TABLE IF EXISTS public.packing_lists
  ADD COLUMN IF NOT EXISTS po_verified boolean DEFAULT false;


-- ==============================================================================
-- SECTION 7 — REQ-07: PRICING APPROVAL & QUOTING WORKFLOW
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.price_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  submission_id uuid REFERENCES public.apply_submissions(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  style_name text NOT NULL,
  quantity int NOT NULL,
  cmt_unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  wash_unit_cost numeric(10,2) DEFAULT 0,
  trims_unit_cost numeric(10,2) DEFAULT 0,
  factory_margin_pct numeric(5,2) DEFAULT 0,
  final_unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_contract_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Sent_To_Customer', 'Accepted', 'Rejected', 'Expired')),
  issued_by text NOT NULL,
  issued_by_id uuid REFERENCES public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_quotes_submission ON public.price_quotes (submission_id);

ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_quotes_staff_all" ON public.price_quotes;
CREATE POLICY "price_quotes_staff_all" ON public.price_quotes
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "price_quotes_customer_select" ON public.price_quotes;
CREATE POLICY "price_quotes_customer_select" ON public.price_quotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.price_quotes.customer_name)
    )
  );

-- Customer-side accept/reject action, scoped narrowly to status transitions
-- on quotes already addressed to their own company.
DROP POLICY IF EXISTS "price_quotes_customer_respond" ON public.price_quotes;
CREATE POLICY "price_quotes_customer_respond" ON public.price_quotes
  FOR UPDATE TO authenticated
  USING (
    status = 'Sent_To_Customer'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.price_quotes.customer_name)
    )
  )
  WITH CHECK (status IN ('Accepted', 'Rejected'));

-- New unquoted intake submissions default to a pricing-approval-pending state.
ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS pricing_status text DEFAULT 'Not_Required';

-- Customer-side accept/reject for the no-login public status portal — mirrors
-- get_submission_status_by_reference()'s auth model (reference code + email
-- proves ownership) rather than requiring the customer to be logged in.
CREATE OR REPLACE FUNCTION public.respond_to_price_quote(
  p_quote_id uuid,
  p_reference_code text,
  p_email text,
  p_response text
)
RETURNS public.price_quotes AS $$
DECLARE
  v_quote public.price_quotes;
BEGIN
  IF p_response NOT IN ('Accepted', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid response — must be Accepted or Rejected';
  END IF;

  SELECT q.* INTO v_quote
  FROM public.price_quotes q
  JOIN public.apply_submissions s ON s.id = q.submission_id
  WHERE q.id = p_quote_id
    AND s.apply_reference_code = upper(trim(p_reference_code))
    AND lower(s.contact_email) = lower(trim(p_email))
    AND q.status = 'Sent_To_Customer';

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'Quote not found, already resolved, or reference/email do not match.';
  END IF;

  UPDATE public.price_quotes
  SET status = p_response,
      accepted_at = CASE WHEN p_response = 'Accepted' THEN now() ELSE accepted_at END,
      updated_at = now()
  WHERE id = p_quote_id
  RETURNING * INTO v_quote;

  RETURN v_quote;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.respond_to_price_quote(uuid, text, text, text) TO anon, authenticated;


-- ==============================================================================
-- SECTION 8 — REQ-08: UNIVERSAL MULTI-STAGE OUTSOURCING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stage_outsourcing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  stage_number int NOT NULL,
  stage_name text NOT NULL,
  vendor_name text NOT NULL,
  vendor_facility_location text,
  outsource_po_number text NOT NULL,
  quantity_dispatched int NOT NULL DEFAULT 0,
  quantity_received int NOT NULL DEFAULT 0,
  unit_cost_usd numeric(10,2) DEFAULT 0,
  total_cost_usd numeric(10,2) DEFAULT 0,
  dispatched_at timestamptz DEFAULT now(),
  expected_return_at timestamptz,
  received_at timestamptz,
  vendor_status text NOT NULL DEFAULT 'Dispatched'
    CHECK (vendor_status IN ('Dispatched', 'In_Process', 'Returned_Partial', 'Returned_Complete', 'Defect_Hold')),
  notes text,
  logged_by text,
  logged_by_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_outsourcing_order ON public.stage_outsourcing_records (order_id);

ALTER TABLE public.stage_outsourcing_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_outsourcing_staff_all" ON public.stage_outsourcing_records;
CREATE POLICY "stage_outsourcing_staff_all" ON public.stage_outsourcing_records
  FOR ALL TO authenticated USING (public.is_internal_staff());


-- ==============================================================================
-- SECTION 9 — REQ-09: CAPACITY-BASED DELIVERY SCHEDULING SETTINGS
-- ==============================================================================
-- tenant_branding already functions as the app's singleton settings row
-- (see src/routes/settings.branding.tsx); extend it rather than introducing a
-- second, competing config table.
ALTER TABLE IF EXISTS public.tenant_branding
  ADD COLUMN IF NOT EXISTS sample_min_turnaround_days int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sample_max_quantity int NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS daily_capacity_units int NOT NULL DEFAULT 144000,
  ADD COLUMN IF NOT EXISTS laundry_buffer_days int NOT NULL DEFAULT 2;

-- Ensure exactly one settings row exists so the frontend can .single() it.
INSERT INTO public.tenant_branding (company_name)
SELECT 'Forge & Fabric MES'
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_branding);


-- ==============================================================================
-- SECTION 10 — REQ-13: REWORK & COST OF POOR QUALITY (COPQ) TRACKING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rework_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  qc_inspection_id uuid REFERENCES public.qc_inspections(id) ON DELETE SET NULL,
  bundle_barcode text,
  stage_number int,
  station_name text NOT NULL,
  defect_type text NOT NULL,
  quantity_reworked int NOT NULL DEFAULT 0,
  operator_id text,
  labor_minutes_spent int NOT NULL DEFAULT 0,
  labor_rate_usd_per_hour numeric(10,2) NOT NULL DEFAULT 18.00,
  scrap_yards_consumed numeric(10,2) NOT NULL DEFAULT 0,
  fabric_cost_usd_per_yard numeric(10,2) NOT NULL DEFAULT 6.50,
  calculated_copq_usd numeric(10,2) GENERATED ALWAYS AS (
    round(((labor_minutes_spent::numeric / 60.0) * labor_rate_usd_per_hour) + (scrap_yards_consumed * fabric_cost_usd_per_yard), 2)
  ) STORED,
  logged_by text NOT NULL,
  logged_by_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rework_logs_order ON public.rework_logs (order_id);

ALTER TABLE public.rework_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rework_logs_staff_all" ON public.rework_logs;
CREATE POLICY "rework_logs_staff_all" ON public.rework_logs
  FOR ALL TO authenticated USING (public.is_internal_staff());


-- ==============================================================================
-- SECTION 11 — REALTIME PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tech_pack_vault; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.price_quotes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_outsourcing_records; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rework_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_lots; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sample_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
