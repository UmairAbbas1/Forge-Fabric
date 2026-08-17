-- ==============================================================================
-- FORGE & FABRIC — CUT TICKETS, BUNDLES & SHOPFLOOR PERSISTENCE MIGRATION
-- Migration: 20260818000000_update_cut_tickets_schema.sql
-- ==============================================================================

-- 1. DROP RESTRICTIVE FOREIGN KEYS TO ALLOW TEXT / CUSTOM WORK ORDER CODES
ALTER TABLE IF EXISTS public.cut_tickets DROP CONSTRAINT IF EXISTS cut_tickets_work_order_id_fkey;
ALTER TABLE IF EXISTS public.cut_tickets DROP CONSTRAINT IF EXISTS cut_tickets_planned_pcs_check;
ALTER TABLE IF EXISTS public.cut_tickets DROP CONSTRAINT IF EXISTS cut_tickets_total_layers_check;
ALTER TABLE IF EXISTS public.cut_tickets DROP CONSTRAINT IF EXISTS cut_tickets_cut_number_key;

ALTER TABLE IF EXISTS public.bundles DROP CONSTRAINT IF EXISTS bundles_work_order_id_fkey;
ALTER TABLE IF EXISTS public.bundles DROP CONSTRAINT IF EXISTS bundles_cut_ticket_id_fkey;

-- 2. ALTER COLUMNS TO BE FLEXIBLE AND COMPATIBLE WITH ALL WORK ORDER FORMATS
ALTER TABLE IF EXISTS public.cut_tickets 
  ALTER COLUMN work_order_id DROP NOT NULL,
  ALTER COLUMN work_order_id TYPE text USING work_order_id::text,
  ALTER COLUMN planned_pcs DROP NOT NULL,
  ALTER COLUMN planned_pcs SET DEFAULT 0,
  ALTER COLUMN total_layers DROP NOT NULL,
  ALTER COLUMN total_layers SET DEFAULT 1,
  ALTER COLUMN cut_number DROP NOT NULL;

ALTER TABLE IF EXISTS public.bundles 
  ALTER COLUMN work_order_id DROP NOT NULL,
  ALTER COLUMN work_order_id TYPE text USING work_order_id::text,
  ALTER COLUMN cut_ticket_id DROP NOT NULL,
  ALTER COLUMN cut_ticket_id TYPE text USING cut_ticket_id::text;

-- 3. ADD ALL MES/SHOPFLOOR FIELDS TO CUT_TICKETS & BUNDLES
ALTER TABLE IF EXISTS public.cut_tickets
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS wo_number text,
  ADD COLUMN IF NOT EXISTS style_code text,
  ADD COLUMN IF NOT EXISTS colorway text,
  ADD COLUMN IF NOT EXISTS fabric_lot_id text,
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS yards_allocated numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_planned_pcs numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_actual_pcs numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_cut_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS size_breakdown jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.bundles
  ADD COLUMN IF NOT EXISTS style_code text,
  ADD COLUMN IF NOT EXISTS size_code text,
  ADD COLUMN IF NOT EXISTS bundle_qty numeric,
  ADD COLUMN IF NOT EXISTS shade_lot text,
  ADD COLUMN IF NOT EXISTS current_operation_id text,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. CREATE INVENTORY_ISSUANCES & SCAN_EVENTS TABLES IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.inventory_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id text,
  quantity_issued numeric DEFAULT 0,
  issued_to_department text DEFAULT 'Cutting Floor',
  reference_code text,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id text,
  bundle_barcode text,
  operation_name text,
  operator_name text,
  stage_id integer DEFAULT 6,
  status text DEFAULT 'Scanned_In',
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OPEN ROW LEVEL SECURITY (RLS) POLICIES FOR ALL SHOPFLOOR TABLES
ALTER TABLE IF EXISTS public.cut_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cut_tickets_full_access" ON public.cut_tickets;
DROP POLICY IF EXISTS "cut_tickets_staff_all" ON public.cut_tickets;
DROP POLICY IF EXISTS "cut_tickets_production_all" ON public.cut_tickets;
CREATE POLICY "cut_tickets_full_access" ON public.cut_tickets 
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bundles_full_access" ON public.bundles;
DROP POLICY IF EXISTS "bundles_staff_all" ON public.bundles;
DROP POLICY IF EXISTS "bundles_production_all" ON public.bundles;
CREATE POLICY "bundles_full_access" ON public.bundles 
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.scan_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan_events_full_access" ON public.scan_events;
CREATE POLICY "scan_events_full_access" ON public.scan_events 
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.inventory_issuances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_issuances_full_access" ON public.inventory_issuances;
CREATE POLICY "inventory_issuances_full_access" ON public.inventory_issuances 
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.address_book DROP CONSTRAINT IF EXISTS address_book_company_id_fkey;
ALTER TABLE IF EXISTS public.address_book DROP CONSTRAINT IF EXISTS address_book_address_type_check;
ALTER TABLE IF EXISTS public.address_book ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.address_book
  ADD COLUMN IF NOT EXISTS address_label text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS street_1 text DEFAULT '1150 Industry Way',
  ADD COLUMN IF NOT EXISTS city text DEFAULT 'Los Angeles',
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS state_province text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS postal_code text DEFAULT '90040',
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE IF EXISTS public.address_book ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "address_book_full_access" ON public.address_book;
CREATE POLICY "address_book_full_access" ON public.address_book
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.packing_lists
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS destination_address text,
  ADD COLUMN IF NOT EXISTS total_cartons numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_units numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carrier_name text DEFAULT 'FedEx Freight Express',
  ADD COLUMN IF NOT EXISTS tracking_reference text,
  ADD COLUMN IF NOT EXISTS pod_signature_ref text,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE IF EXISTS public.packing_lists DROP CONSTRAINT IF EXISTS packing_lists_destination_address_id_fkey;
ALTER TABLE IF EXISTS public.packing_lists DROP CONSTRAINT IF EXISTS packing_lists_purchase_order_id_fkey;
ALTER TABLE IF EXISTS public.packing_lists DROP CONSTRAINT IF EXISTS packing_lists_carrier_id_fkey;
ALTER TABLE IF EXISTS public.packing_lists ALTER COLUMN destination_address_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.packing_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "packing_lists_full_access" ON public.packing_lists;
CREATE POLICY "packing_lists_full_access" ON public.packing_lists
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 6. QC INSPECTIONS & QC RECORDS SCHEMA UPGRADES
ALTER TABLE IF EXISTS public.qc_inspections DROP CONSTRAINT IF EXISTS qc_inspections_bundle_id_fkey;
ALTER TABLE IF EXISTS public.qc_inspections DROP CONSTRAINT IF EXISTS qc_inspections_inspected_qty_check;

ALTER TABLE IF EXISTS public.qc_inspections
  ALTER COLUMN bundle_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS bundle_barcode text,
  ADD COLUMN IF NOT EXISTS style_code text,
  ADD COLUMN IF NOT EXISTS colorway text,
  ADD COLUMN IF NOT EXISTS size_code text,
  ADD COLUMN IF NOT EXISTS stage_checkpoint text,
  ADD COLUMN IF NOT EXISTS result text DEFAULT 'Pass',
  ADD COLUMN IF NOT EXISTS operator_name_internal text,
  ADD COLUMN IF NOT EXISTS supervisor_name text,
  ADD COLUMN IF NOT EXISTS machine_id_internal text;

ALTER TABLE IF EXISTS public.qc_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qc_inspections_full_access" ON public.qc_inspections;
DROP POLICY IF EXISTS "qc_inspections_staff_all" ON public.qc_inspections;
DROP POLICY IF EXISTS "qc_inspections_production" ON public.qc_inspections;
CREATE POLICY "qc_inspections_full_access" ON public.qc_inspections
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.qc_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qc_records_full_access" ON public.qc_records;
CREATE POLICY "qc_records_full_access" ON public.qc_records
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 7. CREATE EQUIPMENT, BRANDING & UPDATE REQUESTS TABLES IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'Active',
  facility_id text DEFAULT 'FAC-01',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_full_access" ON public.equipment;
CREATE POLICY "equipment_full_access" ON public.equipment
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT 'Forge & Fabric MES',
  primary_color text DEFAULT '#b45309',
  secondary_color text DEFAULT '#1c1917',
  logo_url text,
  favicon_url text,
  support_email text DEFAULT 'support@forgefabric.com',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.tenant_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_branding_full_access" ON public.tenant_branding;
CREATE POLICY "tenant_branding_full_access" ON public.tenant_branding
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id text,
  reference_code text,
  customer_id text,
  change_type text,
  requested_changes jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.update_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "update_requests_full_access" ON public.update_requests;
CREATE POLICY "update_requests_full_access" ON public.update_requests
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 8. REALTIME SUBSCRIPTION REGISTRATION
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cut_tickets;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bundles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qc_inspections;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_branding;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
