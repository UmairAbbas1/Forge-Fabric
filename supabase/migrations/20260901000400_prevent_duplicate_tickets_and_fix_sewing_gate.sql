-- ============================================================================
-- PREVENT DUPLICATE CUT/SEWING TICKETS + FIX THE STAGE-7/8 SEWING GATE
--
-- Root cause (confirmed live against SMP-2026-00061 before writing this):
-- 1. cutting.tsx mirror-writes one sewing_bundles row per cut bundle
--    (e.g. BND-FIT-L-01) as a side effect of completing a CUT ticket — a
--    leftover of the pre-ticket-based sewing flow. The new ticket-based
--    sewing.tsx never touches those specific bundle_id rows, so they sit
--    "Active" forever, alongside the real sewing_tickets-derived rows.
-- 2. checkStageAdvancement(toStage=8) (client) gates the 7->8 transition on
--    sewing_bundles completeness. enforce_order_stage_gates() (DB trigger)
--    gates the SAME rule on the 8->9 transition instead (NEW.current_stage
--    > 8 AND OLD.current_stage <= 8) — a genuine pre-existing mismatch. An
--    order can pass the client's 7->8 check, sit at stage 8, then have the
--    DB trigger reject 8->9 later citing the same rule — reproduced live:
--    "Order SMP-2026-00061 has no completed sewing ticket. Cannot leave
--    Stage 8 without a real, completed sewing ticket."
--
-- Fix: the DB trigger's sewing-completion check moves to the 7->8 boundary
-- (matching the client and the real business rule — you can't do Pre-Wash
-- QC on garments that were never confirmed sewn), and both the client and
-- the trigger now check the real sewing_tickets table first, falling back
-- to legacy sewing_bundles only for orders that never used the ticket flow
-- (no sewing_tickets rows exist for them at all).
--
-- Also adds a BEFORE INSERT duplicate-ticket guard on both cut_tickets and
-- sewing_tickets: blocks a second ticket for the same work order unless the
-- existing one's most recent QC verdict for that stage was Reject/Rework
-- (a legitimate redo), confirmed with the project owner before building.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ------------------------------------------------------------------------------
-- Duplicate-ticket guard: sewing_tickets
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_duplicate_sewing_ticket()
RETURNS trigger AS $$
DECLARE
  v_existing_count int;
  v_latest_qc_result text;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM public.sewing_tickets t
  WHERE t.work_order_id = NEW.work_order_id;

  IF v_existing_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT result INTO v_latest_qc_result
  FROM public.qc_records
  WHERE order_id = NEW.work_order_id AND stage_checkpoint = 'Inline Sewing QC'
  ORDER BY inspected_date DESC NULLS LAST
  LIMIT 1;

  IF v_latest_qc_result IS DISTINCT FROM 'Reject' AND v_latest_qc_result IS DISTINCT FROM 'Rework' THEN
    RAISE EXCEPTION 'A sewing ticket already exists for order % and has not been marked for rework via Inline Sewing QC. Complete or resolve the existing ticket instead of creating a duplicate.', NEW.work_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_sewing_ticket ON public.sewing_tickets;
CREATE TRIGGER trigger_prevent_duplicate_sewing_ticket
  BEFORE INSERT ON public.sewing_tickets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_sewing_ticket();

-- ------------------------------------------------------------------------------
-- Duplicate-ticket guard: cut_tickets (same rule, gated on "First Cut
-- Approval" QC checkpoint instead).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_duplicate_cut_ticket()
RETURNS trigger AS $$
DECLARE
  v_existing_count int;
  v_latest_qc_result text;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM public.cut_tickets t
  WHERE t.work_order_id = NEW.work_order_id;

  IF v_existing_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT result INTO v_latest_qc_result
  FROM public.qc_records
  WHERE order_id = NEW.work_order_id AND stage_checkpoint = 'First Cut Approval'
  ORDER BY inspected_date DESC NULLS LAST
  LIMIT 1;

  IF v_latest_qc_result IS DISTINCT FROM 'Reject' AND v_latest_qc_result IS DISTINCT FROM 'Rework' THEN
    RAISE EXCEPTION 'A cut ticket already exists for order % and has not been marked for rework via First Cut Approval. Complete or resolve the existing ticket instead of creating a duplicate.', NEW.work_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_cut_ticket ON public.cut_tickets;
CREATE TRIGGER trigger_prevent_duplicate_cut_ticket
  BEFORE INSERT ON public.cut_tickets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_cut_ticket();

-- ------------------------------------------------------------------------------
-- enforce_order_stage_gates(): same function as
-- 20260901000300_outsource_shortage_resolution.sql, with the sewing-
-- completion check (a) moved to the correct 7->8 boundary and (b) checking
-- the real sewing_tickets table first, falling back to legacy sewing_bundles
-- only when an order has no sewing_tickets rows at all (pre-ticket-flow
-- orders). Every other check in this function is copied verbatim.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_stage_gates()
RETURNS trigger AS $$
DECLARE
  v_pending_count int;
  v_cut_ok boolean;
  v_sewing_ok boolean;
  v_wash_ok boolean;
  v_ticket_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN

    -- Outsource-QC-return gate (unchanged from 20260901000300).
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

    -- Leaving stage 7 (Sewing Assembly) requires real completed sewing
    -- work — the real sewing_tickets table when this order has ever used
    -- the ticket-based flow, otherwise the legacy sewing_bundles rows.
    -- Moved here from the (incorrect) stage-8 boundary this function
    -- previously used, to match checkStageAdvancement(toStage=8) and the
    -- real business rule: sewing must be done before Pre-Wash QC.
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

-- ------------------------------------------------------------------------------
-- Data cleanup — confirmed with project owner: keep ST-2026-7924 (later,
-- 2026-08-27 14:39) as the real ticket for SMP-2026-00061, remove
-- ST-2026-8606 (2026-08-27 11:17) and its sewing_bundles mirror row.
-- Scoped to this exact ticket_number/order — never a blanket dedup.
-- ------------------------------------------------------------------------------
DELETE FROM public.sewing_tickets WHERE ticket_number = 'ST-2026-8606' AND work_order_id = 'SMP-2026-00061';
DELETE FROM public.sewing_bundles WHERE bundle_id = 'ST-2026-8606' AND order_id = 'SMP-2026-00061';
