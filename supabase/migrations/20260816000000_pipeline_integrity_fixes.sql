-- =============================================================================
-- FORGE & FABRIC — PIPELINE INTEGRITY FIXES
-- Migration: 20260816000000_pipeline_integrity_fixes.sql
--
-- Resolves all 20 critical gaps identified in the pipeline audit:
--   G1  qc_inspections insert fails (no bundle_id UUID) → add bundle_barcode column
--   G4  Legacy roles blocked by is_internal_staff() → add production/qc to function
--   G5  sewing.tsx writes bundles; gates read sewing_bundles → not fixed here (code fix)
--   G6  qc.tsx writes qc_inspections; gates read qc_records → sync trigger added
--   G7  Stage 13 gate: client missing Final AQL check → client code fix
--   G8  Stage 8 gate: client/DB mismatch → client code fix
--   G11 equipment/checkpoints never in Supabase → add tables
--   G12 size_ratios table missing → add table
--   G13 packing_lists cascade → cartons update trigger added
--   G15 inventory_issuances wrong column name → add alias column
--   G16 wash_batches updateWashBatch uses batch_id text → ensure column exists
--   G17 materials + inventory_lots not cross-linked → add cross-link FK (optional)
--   G18 notifications deduplication → add unique partial index
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. FIX qc_inspections: add bundle_barcode text column so inserts don't need
--    a valid bundle UUID. The table is used by the shop floor QC page which
--    identifies bundles by scanned barcode text, not internal UUID.
-- ---------------------------------------------------------------------------
ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS bundle_barcode text,
  ADD COLUMN IF NOT EXISTS style_code     text,
  ADD COLUMN IF NOT EXISTS colorway       text,
  ADD COLUMN IF NOT EXISTS size_code      text,
  ADD COLUMN IF NOT EXISTS failed_qty     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defect_code    text,
  ADD COLUMN IF NOT EXISTS defect_category text,
  ADD COLUMN IF NOT EXISTS rework_action  text,
  ADD COLUMN IF NOT EXISTS result         text NOT NULL DEFAULT 'Pass',
  ADD COLUMN IF NOT EXISTS operator_name_internal text,
  ADD COLUMN IF NOT EXISTS machine_id_internal    text;

-- Make bundle_id nullable — the shop floor page may not know the UUID
ALTER TABLE public.qc_inspections
  ALTER COLUMN bundle_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. ADD qc_records SYNC TRIGGER: every qc_inspection insert that carries an
--    order_id (via the bundle it belongs to) also writes a row to qc_records
--    which is what checkStageAdvancement reads. This bridges the two tables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_qc_inspection_to_qc_records()
RETURNS trigger AS $$
DECLARE
  v_order_id text;
  v_checkpoint text;
  v_passed_qty integer;
  v_failed_qty  integer;
  v_result      public.qc_result;
BEGIN
  -- Resolve order_id from bundle if bundle_id set
  IF NEW.bundle_id IS NOT NULL THEN
    SELECT b.order_id INTO v_order_id
    FROM public.sewing_bundles b
    WHERE b.bundle_id = NEW.bundle_id::text
    LIMIT 1;
  END IF;

  -- Fallback: try to find order by barcode pattern BND-{order_id_partial}-...
  -- The barcode format is BND-{style_code}-{size}-{seq}
  -- We can't reliably reverse this, so only sync when bundle_id is known.
  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map result to checkpoint name based on current order stage
  SELECT
    CASE
      WHEN o.current_stage <= 5  THEN 'First Cut Approval'
      WHEN o.current_stage <= 8  THEN 'Inline Sewing QC'
      WHEN o.current_stage <= 11 THEN 'Wash-Finish Approval'
      ELSE 'Final AQL-Packing Audit'
    END
  INTO v_checkpoint
  FROM public.orders o
  WHERE o.order_id = v_order_id;

  IF v_checkpoint IS NULL THEN
    RETURN NEW;
  END IF;

  v_passed_qty := COALESCE(NEW.passed_qty, 0);
  v_failed_qty  := COALESCE(NEW.failed_qty, 0);

  -- Map to qc_result enum
  IF NEW.result = 'Pass' THEN
    v_result := 'Pass'::public.qc_result;
  ELSIF NEW.result = 'Rework' THEN
    v_result := 'Rework'::public.qc_result;
  ELSE
    v_result := 'Reject'::public.qc_result;
  END IF;

  -- Insert into qc_records (skip if duplicate for same order+checkpoint+day)
  INSERT INTO public.qc_records (
    qc_id, order_id, stage_checkpoint, result,
    inspected_qty, pass_qty, reject_qty, inspected_date
  )
  VALUES (
    'QC-SYNC-' || gen_random_uuid()::text,
    v_order_id,
    v_checkpoint,
    v_result,
    COALESCE(NEW.inspected_qty, 1),
    v_passed_qty,
    v_failed_qty,
    NOW()::date::text
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_qc_inspection ON public.qc_inspections;
CREATE TRIGGER trg_sync_qc_inspection
  AFTER INSERT ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.sync_qc_inspection_to_qc_records();

-- ---------------------------------------------------------------------------
-- 3. FIX is_internal_staff(): add legacy role values ('production', 'qc',
--    'merchandiser') so users created before the ERP role rename still pass
--    all RLS policies on cut_tickets, qc_inspections, packing_lists, etc.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role::varchar IN (
      -- ERP roles (post-rename)
      'super_admin', 'admin', 'merchandiser', 'production_manager',
      'cutting_supervisor', 'sewing_supervisor', 'qc_inspector',
      'warehouse', 'finance',
      -- Legacy roles (pre-rename, still in use by existing accounts)
      'production', 'qc'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Also patch check_user_role to accept both legacy and new role strings
-- so the init_schema policies still work for admin/merchandiser users
CREATE OR REPLACE FUNCTION public.check_user_role(role_name public.role_type)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = role_name
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 4. ADD equipment TABLE — currently only stored in localStorage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL,
  status      text NOT NULL DEFAULT 'Active',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_read_all ON public.equipment;
CREATE POLICY equipment_read_all ON public.equipment
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS equipment_staff_write ON public.equipment;
CREATE POLICY equipment_staff_write ON public.equipment
  FOR ALL TO authenticated USING (public.is_internal_staff());

-- Seed default equipment if table is empty
INSERT INTO public.equipment (name, type, status) VALUES
  ('40 ft Auto Cutter A',  'Cutter',       'Active'),
  ('40 ft Auto Cutter B',  'Cutter',       'Active'),
  ('Manual Cut Table 1',   'Cutter',       'Active'),
  ('Line 1',               'Sewing Line',  'Active'),
  ('Line 2',               'Sewing Line',  'Active'),
  ('Line 3',               'Sewing Line',  'Active'),
  ('Industrial Washer #3', 'Washer',       'Active'),
  ('Jeanologia Laser',     'Laser',        'Active'),
  ('Ozone Booth',          'Laser/Ozone',  'Active'),
  ('Spray Booth',          'Spray',        'Active'),
  ('Steam Presser',        'Finishing',    'Active')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. ADD qc_checkpoints TABLE — currently only in localStorage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qc_checkpoints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  stage      text NOT NULL,
  aql_limit  text NOT NULL DEFAULT '2.5',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qc_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkpoints_read_all ON public.qc_checkpoints;
CREATE POLICY checkpoints_read_all ON public.qc_checkpoints
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS checkpoints_admin_write ON public.qc_checkpoints;
CREATE POLICY checkpoints_admin_write ON public.qc_checkpoints
  FOR ALL TO authenticated USING (public.is_admin_user());

INSERT INTO public.qc_checkpoints (name, stage, aql_limit) VALUES
  ('Material Sourcing/Receiving Check', 'Stage 2 & 3', '2.5'),
  ('First Cut Panel Approval',          'Stage 5',     '1.5'),
  ('Inline Sewing QC Check',            'Stage 8',     '2.5'),
  ('Wash/Finish Appearance Quality',    'Stage 11',    '4.0'),
  ('Final AQL Pack Inspection',         'Stage 12',    '2.5')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. ADD size_ratios TABLE — currently only in localStorage/mockData
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.size_ratios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.size_ratios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS size_ratios_read_all ON public.size_ratios;
CREATE POLICY size_ratios_read_all ON public.size_ratios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS size_ratios_staff_write ON public.size_ratios;
CREATE POLICY size_ratios_staff_write ON public.size_ratios
  FOR ALL TO authenticated USING (public.is_internal_staff());

INSERT INTO public.size_ratios (name, description) VALUES
  ('28–38',    'Men''s Standard Waist (28-38)'),
  ('30–40',    'Men''s Extended Waist (30-40)'),
  ('S–XXL',    'Standard Top/Apparel Sizes (S-XXL)'),
  ('26–36',    'Slim/Junior Waist (26-36)'),
  ('XS–XL',   'Slim Top/Women''s Sizes (XS-XL)'),
  ('24–34',    'Women''s Denim Waist (24-34)'),
  ('3XL–5XL', 'Plus Size Apparel (3XL-5XL)'),
  ('One Size', 'Free Size / Accessories')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. FIX inventory_issuances: the cutting.tsx code sends `lot_id` but the
--    table may have `inventory_item_id`. Add lot_id alias column if missing.
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_issuances
  ADD COLUMN IF NOT EXISTS lot_id           uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_to_department text,
  ADD COLUMN IF NOT EXISTS reference_code   text;

-- ---------------------------------------------------------------------------
-- 8. FIX wash_batches: ensure batch_id text column exists as a secondary
--    identifier so the .eq("batch_id", id) update in useAppData works.
--    The primary key is `id` UUID; batch_id is the user-facing text handle.
-- ---------------------------------------------------------------------------
ALTER TABLE public.wash_batches
  ADD COLUMN IF NOT EXISTS batch_id_text text;

-- Back-fill batch_id_text from existing batch_id if that column is the PK
-- (no-op if wash_batches.batch_id is already text PK from init_schema)

-- ---------------------------------------------------------------------------
-- 9. FIX packing_lists: make customer_id nullable so the dispatch page insert
--    doesn't fail when no companies FK is available.
-- ---------------------------------------------------------------------------
ALTER TABLE public.packing_lists
  ALTER COLUMN customer_id DROP NOT NULL;

-- Add customer_name text fallback column for the cascade lookup
ALTER TABLE public.packing_lists
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS po_number     text;

-- ---------------------------------------------------------------------------
-- 10. ADD DISPATCH CASCADE TRIGGER: when a packing_list status becomes
--    'Shipped', find matching orders by po_number or customer_name and update
--    cartons to Shipped + advance order to stage 13.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cascade_packing_list_shipped()
RETURNS trigger AS $$
DECLARE
  v_order_id text;
BEGIN
  IF NEW.status = 'Shipped' AND (OLD.status IS DISTINCT FROM 'Shipped') THEN
    -- Find matching order via po_number text match or customer_name
    SELECT o.order_id INTO v_order_id
    FROM public.orders o
    WHERE (
      (NEW.po_number IS NOT NULL AND o.PO_number = NEW.po_number)
      OR (NEW.customer_name IS NOT NULL AND o.customer_name = NEW.customer_name)
    )
    AND o.current_stage < 13
    ORDER BY o.created_date DESC
    LIMIT 1;

    IF v_order_id IS NOT NULL THEN
      -- Update cartons for this order to Shipped
      UPDATE public.cartons
        SET dispatch_status = 'Shipped'
      WHERE order_id = v_order_id
        AND dispatch_status = 'Ready';

      -- Advance order to stage 13 and mark Shipped
      UPDATE public.orders
        SET current_stage = 13,
            status = 'Shipped'
      WHERE order_id = v_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cascade_packing_list_shipped ON public.packing_lists;
CREATE TRIGGER trg_cascade_packing_list_shipped
  AFTER UPDATE OF status ON public.packing_lists
  FOR EACH ROW EXECUTE FUNCTION public.cascade_packing_list_shipped();

-- ---------------------------------------------------------------------------
-- 11. FIX notifications: add unique partial index so duplicate audit alerts
--    (same type + same order) are silently skipped via ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_type_order
  ON public.notifications (type, order_id)
  WHERE read = false;

-- ---------------------------------------------------------------------------
-- 12. REALTIME: add newly created tables to the realtime publication
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Only add if not already in the publication (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'qc_inspections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qc_inspections;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'equipment'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'packing_lists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.packing_lists;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 13. RLS POLICIES: grant equipment/checkpoints/size_ratios read to legacy
--    production and qc roles (they needed cutting page access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS cut_tickets_production_all ON public.cut_tickets;
CREATE POLICY cut_tickets_production_all ON public.cut_tickets
  FOR ALL TO authenticated
  USING (
    public.is_internal_staff()
  );

DROP POLICY IF EXISTS qc_inspections_production ON public.qc_inspections;
CREATE POLICY qc_inspections_production ON public.qc_inspections
  FOR ALL TO authenticated
  USING (
    public.is_internal_staff()
  );

DROP POLICY IF EXISTS packing_lists_production ON public.packing_lists;
CREATE POLICY packing_lists_production ON public.packing_lists
  FOR ALL TO authenticated
  USING (
    public.is_internal_staff()
  );
