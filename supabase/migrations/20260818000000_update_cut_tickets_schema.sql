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

-- 7. REALTIME SUBSCRIPTION REGISTRATION
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
END $$;
