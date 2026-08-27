-- ============================================================================
-- OUTSOURCE SHORTAGE RESOLUTION — closes a gap in the mandatory outsource
-- return-QC gate (20260825000000 / 20260826000000): return_qc_status
-- reflects QUALITY of whatever pieces actually arrived, which is a genuinely
-- different question from whether the FULL dispatched quantity came back.
-- A partial return whose received pieces pass quality (return_qc_status =
-- 'Passed'/'Partial_Pass') was previously enough to unblock the stage gate
-- even with a live, unresolved quantity_short > 0 — the missing pieces were
-- silently ignored. This adds an explicit resolution requirement: the
-- shortage must either be zeroed by a follow-up return, or explicitly
-- accepted as final by an authorized user with a logged reason, before the
-- gate opens. No auto-resolution — both paths are explicit, logged actions.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.stage_outsourcing_records
  ADD COLUMN IF NOT EXISTS shortage_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shortage_resolution_reason text,
  ADD COLUMN IF NOT EXISTS shortage_resolved_by text,
  ADD COLUMN IF NOT EXISTS shortage_resolved_at timestamptz;

-- ------------------------------------------------------------------------------
-- enforce_order_stage_gates(): same function as
-- 20260826000000_sewing_tickets_and_gate_hardening.sql, with the outsource
-- return-QC gate's WHERE clause extended to also require shortage
-- resolution. Every other check in this function (cutting/sewing/wash
-- backstops) is copied verbatim, unchanged.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_stage_gates()
RETURNS trigger AS $$
DECLARE
  v_pending_count int;
  v_cut_ok boolean;
  v_sewing_ok boolean;
  v_wash_ok boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN

    -- REQ-15 outsource-QC-return gate, extended: a return is only "resolved"
    -- once it has genuinely passed QC AND (nothing is missing, or a missing
    -- quantity has been explicitly accepted as final).
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

    -- Leaving stage 6 (Precision Cutting) requires a Completed + Approved
    -- cutting_records row — mirrors checkStageAdvancement(toStage=6).
    IF NEW.current_stage > 6 AND OLD.current_stage <= 6 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.cutting_records c
        WHERE c.order_id = OLD.order_id AND c.status = 'Completed' AND c.first_cut_approval_status = 'Approved'
      ) INTO v_cut_ok;
      IF NOT v_cut_ok THEN
        RAISE EXCEPTION 'Order % has no Completed + Approved cutting record. Cannot leave Stage 6 without a real cut ticket.', OLD.order_id;
      END IF;
    END IF;

    -- Leaving stage 8 (Pre-Wash QC gate) requires every sewing_bundles row
    -- for this order to be Completed — mirrors checkStageAdvancement(toStage=8)'s
    -- bundle-completion half.
    IF NEW.current_stage > 8 AND OLD.current_stage <= 8 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.sewing_bundles s WHERE s.order_id = OLD.order_id
      ) AND NOT EXISTS (
        SELECT 1 FROM public.sewing_bundles s WHERE s.order_id = OLD.order_id AND s.status <> 'Completed'
      ) INTO v_sewing_ok;
      IF NOT v_sewing_ok THEN
        RAISE EXCEPTION 'Order % has no completed sewing ticket. Cannot leave Stage 8 without a real, completed sewing ticket.', OLD.order_id;
      END IF;
    END IF;

    -- Leaving stage 11 (Wash & Finish Approval) requires a wash batch
    -- Approved — mirrors checkStageAdvancement(toStage=11), skipped when
    -- washing isn't in this order's selected pipeline (REQ-14).
    IF NEW.current_stage > 11 AND OLD.current_stage <= 11
       AND (OLD.selected_stages IS NULL OR 9 = ANY(OLD.selected_stages)) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.wash_batches w WHERE w.order_id = OLD.order_id AND w.stage = 'Approved'
      ) INTO v_wash_ok;
      IF NOT v_wash_ok THEN
        RAISE EXCEPTION 'Order % has no Approved wash batch. Cannot leave Stage 11 without a completed wash record.', OLD.order_id;
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
