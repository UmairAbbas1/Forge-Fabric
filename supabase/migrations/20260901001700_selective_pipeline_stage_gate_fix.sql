-- ==============================================================================
-- FORGE & FABRIC — Selective-pipeline stage gate fix (confirmed live bug)
-- Migration: 20260901001700_selective_pipeline_stage_gate_fix.sql
-- ==============================================================================
--
-- CONFIRMED ROOT CAUSE (order FF-2026-00005, "Sewing Assembly" only —
-- Cutting & Bundling NOT selected, so selected_stages = {1,2,3,7,8,11,13}):
--
-- 1. enforce_order_stage_gates() had NO guard rejecting a current_stage value
--    that isn't actually a member of the order's own selected_stages at all.
--    A stray client-side "Advance to Stage N+1" action (StageNavigator's
--    Quick Advance button, fixed in the same change) pushed this order from
--    stage 3 straight to stage 4 — Pre-Production Planning, a stage that
--    only belongs to a Cutting-inclusive pipeline — and nothing rejected it.
--
-- 2. The "First Cut Approval" boundary check (entering stage 7, i.e.
--    OLD.current_stage <= 6 -> NEW.current_stage > 6) unconditionally
--    required a Completed+Approved cutting_records row and a passed 'First
--    Cut Approval' QC record — for EVERY order crossing that boundary, even
--    one whose pipeline never includes Cutting at all and will therefore
--    NEVER have either record. This permanently blocked this order (and
--    every other Sewing/Wash-only order) from ever reaching Stage 7, which
--    is exactly the "no sewing ticket exists" / "must pass First Cut
--    Approval" deadlock reported. The Wash-Finish boundary already had this
--    exact bypass pattern (line ~134, `9 = ANY(OLD.selected_stages)`) —
--    this migration applies the same pattern to the Cutting-gated boundary,
--    which never got it.
--
-- Idempotent: CREATE OR REPLACE, safe to re-run.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_order_stage_gates()
RETURNS trigger AS $$
DECLARE
  v_pending_count int;
  v_cut_ok boolean;
  v_sewing_ok boolean;
  v_wash_ok boolean;
  v_ticket_count int;
  v_material_ok boolean;
  v_qc_ok boolean;
  v_carton_ok boolean;
  v_cutting_included boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN

    -- NEW GUARD: an order can never be moved to a stage that isn't part of
    -- its own selective pipeline. This is the actual boundary that should
    -- have caught the stage-4 mis-jump — every stage-specific check below
    -- only fires for boundaries that stage genuinely crosses, but none of
    -- them ever verified the destination stage was a real member of this
    -- order's own selected_stages to begin with.
    IF OLD.selected_stages IS NOT NULL AND NOT (NEW.current_stage = ANY(OLD.selected_stages)) THEN
      RAISE EXCEPTION 'Stage % is not part of order %''s selected production pipeline (%). Choose a stage actually in this order''s pipeline.',
        NEW.current_stage, OLD.order_id, OLD.selected_stages;
    END IF;

    -- Outsource-QC-return gate (unchanged).
    IF OLD.selected_stages IS NULL OR OLD.current_stage = ANY(OLD.selected_stages) THEN
      SELECT count(*) INTO v_pending_count
      FROM public.stage_outsourcing_records r
      WHERE r.order_id = OLD.order_id
        AND r.stage_number = OLD.current_stage
        AND (
          r.return_qc_status NOT IN ('Passed', 'Partial_Pass')
          OR (COALESCE(r.quantity_short, 0) > 0 AND NOT r.shortage_resolved)
        );

      IF v_pending_count > 0 THEN
        RAISE EXCEPTION 'Outsourced work for stage % has % pending return QC inspection(s) or unresolved quantity shortage(s). Cannot advance until all return QC inspections pass and any shortage is either fully received or explicitly accepted as final.',
          OLD.current_stage, v_pending_count;
      END IF;
    END IF;

    -- Material Check checkpoint: entering stage 4 (3->4). Real GRN/material
    -- records Approved AND a 'Material Check' QC record with result 'Pass'.
    -- Unconditional — Material Receiving & Inspection is mandatory on every
    -- order regardless of selected pipeline (see service-scope-constants.ts
    -- resolveSelectedStages: fabric_receiving is always included unless the
    -- customer explicitly declared fully-processed material).
    IF NEW.current_stage >= 4 AND OLD.current_stage < 4 THEN
      SELECT NOT EXISTS (SELECT 1 FROM public.materials m WHERE m.order_id = OLD.order_id AND m.inspection_status IS DISTINCT FROM 'Approved')
        AND EXISTS (SELECT 1 FROM public.materials m WHERE m.order_id = OLD.order_id)
      INTO v_material_ok;
      IF NOT v_material_ok THEN
        RAISE EXCEPTION 'Order % has material records that are not all Approved. Cannot advance to Pre-Production Planning.', OLD.order_id;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.qc_records q WHERE q.order_id = OLD.order_id AND q.stage_checkpoint = 'Material Check' AND q.result = 'Pass'
      ) INTO v_qc_ok;
      IF NOT v_qc_ok THEN
        RAISE EXCEPTION 'Order % has no passed Material Check QC record. Cannot advance to Pre-Production Planning without an independent Material Check inspection.', OLD.order_id;
      END IF;
    END IF;

    -- First Cut Approval checkpoint: entering stage 7 (6->7). FIXED: only
    -- enforced when Cutting & Bundling is actually in this order's selected
    -- pipeline (stage 5 or 6 present) — an order that skips Cutting (e.g.
    -- Sewing Assembly only, customer supplies pre-cut panels) will never
    -- have a cutting_records row or a 'First Cut Approval' QC record, and
    -- was being permanently blocked here before this fix.
    v_cutting_included := OLD.selected_stages IS NULL OR 5 = ANY(OLD.selected_stages) OR 6 = ANY(OLD.selected_stages);
    IF NEW.current_stage > 6 AND OLD.current_stage <= 6 AND v_cutting_included THEN
      SELECT EXISTS (
        SELECT 1 FROM public.cutting_records c
        WHERE c.order_id = OLD.order_id AND c.status = 'Completed' AND c.first_cut_approval_status = 'Approved'
      ) INTO v_cut_ok;
      IF NOT v_cut_ok THEN
        RAISE EXCEPTION 'Order % has no Completed + Approved cutting record. Cannot leave Stage 6 without a real cut ticket.', OLD.order_id;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.qc_records q WHERE q.order_id = OLD.order_id AND q.stage_checkpoint = 'First Cut Approval' AND q.result = 'Pass'
      ) INTO v_qc_ok;
      IF NOT v_qc_ok THEN
        RAISE EXCEPTION 'Order % has no passed First Cut Approval QC record. Cannot advance to Sewing without an independent First Cut Approval inspection.', OLD.order_id;
      END IF;
    END IF;

    -- Inline Sewing QC checkpoint: entering stage 8 (7->8). Unconditional —
    -- every order reaching stage 7 at all genuinely selected Sewing Assembly
    -- (it's a selectable service, never auto-included), so this boundary is
    -- always real when crossed.
    IF NEW.current_stage > 7 AND OLD.current_stage <= 7 THEN
      SELECT count(*) INTO v_ticket_count FROM public.sewing_tickets t WHERE t.work_order_id = OLD.order_id;

      IF v_ticket_count > 0 THEN
        SELECT EXISTS (
          SELECT 1 FROM public.sewing_tickets t WHERE t.work_order_id = OLD.order_id AND t.status = 'Completed'
        ) AND NOT EXISTS (
          SELECT 1 FROM public.sewing_tickets t WHERE t.work_order_id = OLD.order_id AND t.status <> 'Completed'
        ) INTO v_sewing_ok;
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM public.sewing_bundles s WHERE s.order_id = OLD.order_id
        ) AND NOT EXISTS (
          SELECT 1 FROM public.sewing_bundles s WHERE s.order_id = OLD.order_id AND s.status <> 'Completed'
        ) INTO v_sewing_ok;
      END IF;

      IF NOT v_sewing_ok THEN
        RAISE EXCEPTION 'Order % has no completed sewing ticket. Cannot leave Stage 7 without a real, completed sewing ticket.', OLD.order_id;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.qc_records q WHERE q.order_id = OLD.order_id AND q.stage_checkpoint = 'Inline Sewing QC' AND q.result <> 'Reject'
      ) INTO v_qc_ok;
      IF NOT v_qc_ok THEN
        RAISE EXCEPTION 'Order % has no passed Inline Sewing QC record. Cannot advance to Pre-Wash QC without an independent Inline Sewing QC inspection.', OLD.order_id;
      END IF;
    END IF;

    -- Wash-Finish Approval checkpoint: entering stage 11 (10->11). Already
    -- correctly bypassed when Washing isn't selected (unchanged).
    IF NEW.current_stage > 10 AND OLD.current_stage <= 10
      AND (OLD.selected_stages IS NULL OR 9 = ANY(OLD.selected_stages)) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.wash_batches w WHERE w.order_id = OLD.order_id AND w.stage = 'Approved'
      ) INTO v_wash_ok;
      IF NOT v_wash_ok THEN
        RAISE EXCEPTION 'Order % has no Approved wash batch. Cannot leave Stage 10 without a completed wash record.', OLD.order_id;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.qc_records q WHERE q.order_id = OLD.order_id AND q.stage_checkpoint = 'Wash-Finish Approval' AND q.result = 'Pass'
      ) INTO v_qc_ok;
      IF NOT v_qc_ok THEN
        RAISE EXCEPTION 'Order % has no passed Wash-Finish Approval QC record. Cannot advance to Final Quality Inspection without an independent Wash-Finish Approval inspection.', OLD.order_id;
      END IF;
    END IF;

    -- Final AQL/Packing Audit checkpoint: entering stage 13 (12->13).
    -- Unconditional — Final QC + Dispatch are always in every pipeline.
    IF NEW.current_stage >= 13 AND OLD.current_stage < 13 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.cartons c WHERE c.order_id = OLD.order_id AND c.dispatch_status = 'Ready'
      ) INTO v_carton_ok;
      IF NOT v_carton_ok THEN
        RAISE EXCEPTION 'Order % has no packing carton with status Ready. Cannot advance to Dispatch without a ready carton.', OLD.order_id;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.qc_records q WHERE q.order_id = OLD.order_id AND q.stage_checkpoint = 'Final AQL-Packing Audit' AND q.result = 'Pass'
      ) INTO v_qc_ok;
      IF NOT v_qc_ok THEN
        RAISE EXCEPTION 'Order % has no passed Final AQL-Packing Audit QC record. Cannot advance to Dispatch without a final quality audit.', OLD.order_id;
      END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger already exists (trigger_enforce_order_stage_gates) pointing at
-- this function name — CREATE OR REPLACE above is enough, no re-attach needed.

-- ---------------------------------------------------------------------------
-- One-time data repair: FF-2026-00005 was already pushed to stage 4 by the
-- pre-fix bug (a stage that doesn't exist in its own Sewing-only pipeline).
-- Material Check has genuinely already passed for it (that's how it got to
-- stage 4 in the first place), so the correct real position is stage 7 —
-- the actual next stage in its selected_stages pipeline — not a rollback to
-- 3. Scoped to this exact order and exact stale state only; a no-op if
-- already fixed or if this order's state has since changed some other way.
-- ---------------------------------------------------------------------------
UPDATE public.orders
SET current_stage = 7
WHERE order_id = 'FF-2026-00005'
  AND current_stage = 4
  AND selected_stages IS NOT NULL
  AND NOT (4 = ANY(selected_stages));
