-- ==============================================================================
-- FORGE & FABRIC — SEWING TICKETS + DB-LEVEL STAGE GATE HARDENING
-- Migration: 20260826000000_sewing_tickets_and_gate_hardening.sql
--
-- Two independent pieces, both idempotent:
--
-- PART 1: public.sewing_tickets — the real ticket object sewing.tsx has
-- never had (it was a barcode-scan page with no ticket concept at all).
-- Mirrors the public.cut_tickets pattern established by
-- 20260811000300_erp_mes_shop_floor_and_qc.sql /
-- 20260818000000_update_cut_tickets_schema.sql: text work_order_id (not a
-- work_orders.id FK — work orders in this system are addressed by their
-- human-readable code, e.g. "FF-2608", not a UUID), open RLS matching every
-- other shop-floor table (cut_tickets, bundles, qc_inspections, qc_records
-- are all `FOR ALL ... USING (true)` — role enforcement for shop-floor
-- tables lives in the frontend via usePermission(), not RLS; this migration
-- doesn't change that existing pattern).
--
-- PART 2: enforce_order_stage_gates() extended to check real ticket/record
-- existence at the DB level for the stage transitions that matter most —
-- previously this trigger ONLY enforced the REQ-15 outsource-QC-return rule
-- (see 20260825000000's own comment: "all of today's stage-advancement
-- business rules ... live only in the frontend's checkStageAdvancement()").
-- That gap is exactly how qc.tsx's direct `UPDATE orders SET current_stage`
-- bypassed every real business rule. This does not attempt to reproduce
-- every checkStageAdvancement() branch (that would duplicate a large,
-- frequently-changing frontend rule set in SQL) — it adds hard backstops
-- for the specific gates a ticket-existence bypass would defeat: cutting
-- sign-off (stage 6), sewing ticket completion (stage 8), and wash
-- completion (stage 11). The frontend keeps the fuller, more specific
-- messaging; this is the backstop that makes it impossible to skip.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1 — sewing_tickets
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sewing_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  work_order_id text NOT NULL,
  wo_number text,
  cut_ticket_id text,
  style_code text,
  colorway text,
  size_breakdown jsonb DEFAULT '{}'::jsonb,
  total_planned_pcs numeric DEFAULT 0,
  total_actual_pcs numeric DEFAULT 0,
  line_number int DEFAULT 1,
  operator_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'In_Progress' CHECK (status IN ('In_Progress', 'Completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sewing_tickets_wo ON public.sewing_tickets(work_order_id);
CREATE INDEX IF NOT EXISTS idx_sewing_tickets_status ON public.sewing_tickets(status);

ALTER TABLE public.sewing_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sewing_tickets_full_access" ON public.sewing_tickets;
CREATE POLICY "sewing_tickets_full_access" ON public.sewing_tickets
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sewing_tickets;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;


-- ------------------------------------------------------------------------------
-- PART 1B — stage_outsourcing_records.driver_carrier_name
-- Phase A audit found the dispatch form captures vendor name, PO#, and the
-- staff member who logged the dispatch, but no distinct driver/carrier name
-- (the person/company actually transporting the goods) — additive, nullable
-- column, no backfill needed.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.stage_outsourcing_records
  ADD COLUMN IF NOT EXISTS driver_carrier_name text;


-- ------------------------------------------------------------------------------
-- PART 2 — enforce_order_stage_gates(): real ticket-existence backstops
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

    -- REQ-15 outsource-QC-return gate (unchanged from 20260825000000)
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
    -- bundle-completion half. (The Inline Sewing QC record half is still
    -- checked by the frontend + qc.tsx's own required-ticket validation,
    -- since qc_records has no order-scoped uniqueness this trigger could
    -- cheaply re-verify without risking a false block on legitimate
    -- multi-checkpoint QC history.)
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
