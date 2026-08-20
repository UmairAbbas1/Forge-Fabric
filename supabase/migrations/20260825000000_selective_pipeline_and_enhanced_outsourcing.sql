-- ==============================================================================
-- REQ-14: SELECTIVE STAGE PIPELINE + REQ-15: ENHANCED OUTSOURCING (PHASE 1)
-- Migration: 20260825000000_selective_pipeline_and_enhanced_outsourcing.sql
--
-- Implements Section 8, Parts 1-8 of Forge_Fabric_REQ14_REQ15_Implementation_
-- Plan_v2.md. Idempotent: ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS
-- before CREATE POLICY, CREATE TABLE IF NOT EXISTS throughout.
--
-- FILENAME NOTE: the plan document names this file
-- "20260820000000_selective_pipeline_and_enhanced_outsourcing.sql". That
-- timestamp sorts BEFORE the already-applied 20260821000000 .. 20260824000000
-- migrations -- in particular before 20260823000000_v2_spec_production_
-- upgrade.sql, which is what creates public.stage_outsourcing_records in the
-- first place. Part 3 below runs ALTER TABLE on that table, so keeping the
-- plan's literal filename would make this migration fail on a fresh apply
-- (table not found) even though it was fine on the day the plan was written.
-- This file is dated 20260825000000 instead so it applies strictly after
-- every migration it depends on, while keeping the same content/scope.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1 — selected_stages / requested_stages
-- Default = all 13 stages, so every existing order/work order/backfilled row
-- keeps behaving exactly like the old "Full CMT, no selective pipeline" world.
-- apply_submissions.requested_stages is intentionally nullable: legacy
-- submissions never captured a service selection and NULL must mean
-- "unknown / not requested," not "requested all 13."
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS selected_stages int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12,13}';

ALTER TABLE IF EXISTS public.work_orders
  ADD COLUMN IF NOT EXISTS selected_stages int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12,13}';

ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS requested_stages int[];


-- ------------------------------------------------------------------------------
-- PART 2 — get_next_selected_stage() / get_prev_selected_stage()
-- Client-side mirror lives in src/lib/utils.ts (getNextSelectedStage) so the
-- Kanban/order-detail advance button gets instant feedback; these DB
-- functions are the authoritative source used by SQL callers (e.g. the
-- Part 5 trigger's future extension points, RPCs, edge functions).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_selected_stage(p_order_id text, p_current int)
RETURNS int AS $$
DECLARE
  v_stages int[];
  v_idx int;
BEGIN
  SELECT selected_stages INTO v_stages FROM public.orders WHERE order_id = p_order_id;
  IF v_stages IS NULL THEN
    RETURN p_current + 1;
  END IF;
  v_idx := array_position(v_stages, p_current);
  IF v_idx IS NULL OR v_idx >= array_length(v_stages, 1) THEN
    RETURN NULL;
  END IF;
  RETURN v_stages[v_idx + 1];
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_prev_selected_stage(p_order_id text, p_current int)
RETURNS int AS $$
DECLARE
  v_stages int[];
  v_idx int;
BEGIN
  SELECT selected_stages INTO v_stages FROM public.orders WHERE order_id = p_order_id;
  IF v_stages IS NULL THEN
    RETURN GREATEST(p_current - 1, 1);
  END IF;
  v_idx := array_position(v_stages, p_current);
  IF v_idx IS NULL OR v_idx <= 1 THEN
    RETURN NULL;
  END IF;
  RETURN v_stages[v_idx - 1];
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_next_selected_stage(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prev_selected_stage(text, int) TO authenticated;


-- ------------------------------------------------------------------------------
-- PART 3 — stage_outsourcing_records enhancements (REQ-15)
-- public.stage_outsourcing_records already exists (created by
-- 20260823000000_v2_spec_production_upgrade.sql, Section 8). These are
-- additive columns only -- the table's original vendor_status/quantity_*
-- columns are untouched. dispatched_by_name/received_by_name are left
-- nullable rather than NOT NULL (the plan's literal spec) because ADD COLUMN
-- ... NOT NULL with no default would fail on any row already dispatched
-- before this migration runs; the dispatch/receive UI (Phase 3) is
-- responsible for always supplying them going forward.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.stage_outsourcing_records
  ADD COLUMN IF NOT EXISTS material_type text NOT NULL DEFAULT 'general'
    CHECK (material_type IN ('general', 'fabric_rolls', 'cut_panels', 'stitched_garments', 'washed_garments', 'finished_garments', 'packed_cartons')),
  ADD COLUMN IF NOT EXISTS material_description text,
  ADD COLUMN IF NOT EXISTS dispatched_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatched_by_name text,
  ADD COLUMN IF NOT EXISTS received_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_by_name text,
  ADD COLUMN IF NOT EXISTS return_qc_status text NOT NULL DEFAULT 'Pending'
    CHECK (return_qc_status IN ('Pending', 'Passed', 'Failed', 'Rework', 'Partial_Pass')),
  ADD COLUMN IF NOT EXISTS return_qc_inspection_id uuid,
  ADD COLUMN IF NOT EXISTS return_qc_notes text,
  ADD COLUMN IF NOT EXISTS transport_method text,
  ADD COLUMN IF NOT EXISTS vehicle_reference text;

-- quantity_short is a generated column: Postgres backfills it for existing
-- rows automatically when the ADD COLUMN runs (12+ fast-default / stored
-- generated column rewrite), so no separate UPDATE is needed.
ALTER TABLE IF EXISTS public.stage_outsourcing_records
  ADD COLUMN IF NOT EXISTS quantity_short int GENERATED ALWAYS AS (quantity_dispatched - quantity_received) STORED;


-- ------------------------------------------------------------------------------
-- PART 4 — outsource_return_qc (REQ-15 mandatory QC return gate)
-- Staff-only via RLS -- customers never see outsource data (Section 4E).
-- return_qc_inspection_id above is a plain uuid, not a hard FK, so this
-- table can be created after stage_outsourcing_records already has the
-- column without ordering headaches; application code is responsible for
-- keeping the two in sync (dispatch/receive UI lands in Phase 3).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outsource_return_qc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outsource_record_id uuid NOT NULL REFERENCES public.stage_outsourcing_records(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  stage_number int NOT NULL,
  inspector_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  inspector_name text NOT NULL,
  inspected_qty int NOT NULL,
  passed_qty int NOT NULL DEFAULT 0,
  failed_qty int NOT NULL DEFAULT 0,
  rework_qty int NOT NULL DEFAULT 0,
  defect_notes text,
  photos text[],
  result text NOT NULL DEFAULT 'Pending'
    CHECK (result IN ('Pending', 'Passed', 'Failed', 'Rework', 'Partial_Pass')),
  inspected_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outsource_return_qc_record ON public.outsource_return_qc (outsource_record_id);
CREATE INDEX IF NOT EXISTS idx_outsource_return_qc_order ON public.outsource_return_qc (order_id);

ALTER TABLE public.outsource_return_qc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outsource_return_qc_staff_all" ON public.outsource_return_qc;
CREATE POLICY "outsource_return_qc_staff_all" ON public.outsource_return_qc
  FOR ALL TO authenticated USING (public.is_internal_staff());


-- ------------------------------------------------------------------------------
-- PART 5 — enforce_order_stage_gates(): outsource QC return gate
--
-- IMPORTANT CONTEXT: no function/trigger named enforce_order_stage_gates
-- exists anywhere in the tracked migration history at the time this file
-- runs. It was defined once (20260717000100), then explicitly dropped by
-- 20260808000100_fix_all_rls_recursion_and_pipeline.sql ("temporarily drop
-- stage gate trigger to allow seeding & bulk sync") and never recreated --
-- all of today's stage-advancement business rules (material approval,
-- cutting sign-off, inline QC, etc.) live only in the frontend's
-- checkStageAdvancement() (src/hooks/useAppData.tsx), not in the database.
-- Reimplementing that entire rule set at the DB layer is outside this
-- migration's scope (Section 8 only specifies the two behaviors below). This
-- CREATE is therefore a fresh, narrowly-scoped function -- not a literal
-- "update" of pre-existing logic -- covering exactly what Section 4D asks
-- for: (a) an order cannot leave a stage while outsourced work dispatched
-- for that stage hasn't returned and passed (or partially passed) QC, and
-- (b) that check is skipped for a stage the order's selected_stages pipeline
-- never actually included, matching Section 3G.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_stage_gates()
RETURNS trigger AS $$
DECLARE
  v_pending_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    IF OLD.selected_stages IS NULL OR OLD.current_stage = ANY(OLD.selected_stages) THEN
      SELECT count(*) INTO v_pending_count
      FROM public.stage_outsourcing_records r
      WHERE r.order_id = OLD.order_id
        AND r.stage_number = OLD.current_stage
        AND r.return_qc_status NOT IN ('Passed', 'Partial_Pass');

      IF v_pending_count > 0 THEN
        RAISE EXCEPTION 'Outsourced work for stage % has % pending return QC inspection(s). Cannot advance until all return QC inspections pass.',
          OLD.current_stage, v_pending_count;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_enforce_order_stage_gates ON public.orders;
CREATE TRIGGER trigger_enforce_order_stage_gates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_stage_gates();


-- ------------------------------------------------------------------------------
-- PART 6 — get_submission_status_by_reference() -> requested_stages
--
-- No function change is needed. public.get_submission_status_by_reference()
-- (20260823000000_v2_spec_production_upgrade.sql) declares
-- `v_submission public.apply_submissions` and returns `to_jsonb(v_submission)
-- || jsonb_build_object(...)`. to_jsonb() on a composite row serializes
-- every column of the table's CURRENT definition at call time -- it is not
-- baked into the function body -- so now that Part 1 above has added
-- apply_submissions.requested_stages, every call to this RPC automatically
-- includes a "requested_stages" key with no redefinition required. This note
-- exists so a future reader doesn't "fix" this by duplicating that fragile,
-- multi-child-table EXECUTE-based function body.
-- ------------------------------------------------------------------------------


-- ------------------------------------------------------------------------------
-- PART 7 — performance indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_selected_stages ON public.orders USING gin (selected_stages);
CREATE INDEX IF NOT EXISTS idx_stage_outsourcing_return_qc_status ON public.stage_outsourcing_records (return_qc_status);
CREATE INDEX IF NOT EXISTS idx_stage_outsourcing_order_stage ON public.stage_outsourcing_records (order_id, stage_number);


-- ------------------------------------------------------------------------------
-- PART 8 — backfill
-- Belt-and-suspenders: the ADD COLUMN ... DEFAULT in Part 1 already applies
-- the default to every pre-existing row (Postgres 11+ fast-default), so this
-- UPDATE only matters if a row somehow has selected_stages explicitly NULL.
-- ------------------------------------------------------------------------------
UPDATE public.orders
  SET selected_stages = '{1,2,3,4,5,6,7,8,9,10,11,12,13}'
  WHERE selected_stages IS NULL;

UPDATE public.work_orders
  SET selected_stages = '{1,2,3,4,5,6,7,8,9,10,11,12,13}'
  WHERE selected_stages IS NULL;
