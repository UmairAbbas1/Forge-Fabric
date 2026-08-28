  -- ============================================================================
  -- Closes the QC-checkpoint gate regression confirmed live: a Goods Receipt
  -- Note logged with inspection_status='Approved' was, by itself, sufficient
  -- to advance an order past Material Check — no independent 'Material Check'
  -- QC record was ever required by this trigger. The same gap existed for
  -- First Cut Approval, Inline Sewing QC (frontend already checked it, but
  -- this trigger — the real security boundary — never did), Wash-Finish
  -- Approval (checked at the wrong stage boundary), and Final AQL/Packing
  -- Audit (no check at all, including no carton-ready check).
  --
  -- checkStageAdvancement() in src/hooks/useAppData.tsx was fixed the same
  -- way in the same change — this migration mirrors it exactly so a blocked
  -- advance is enforced here too, not just hinted at in the UI.
  --
  -- Only the five checkpoint boundaries named in the reference architecture
  -- gain a QC-record requirement:
  --   Material Check          -> entering stage 4  (3->4)
  --   First Cut Approval      -> entering stage 7  (6->7)
  --   Inline Sewing QC        -> entering stage 8  (7->8)  [ticket check already existed here]
  --   Wash-Finish Approval    -> entering stage 11 (10->11) [was wrongly at 11->12]
  --   Final AQL/Packing Audit -> entering stage 13 (12->13) [was entirely unchecked]
  -- No other stage transition gains a new requirement.
  --
  -- Idempotent: safe to re-run (CREATE OR REPLACE + DROP/CREATE TRIGGER).
  -- ============================================================================

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
  BEGIN
    IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN

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
      -- records Approved (new — this boundary had NO check before at all) AND
      -- a 'Material Check' QC record with result 'Pass' (new).
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

      -- First Cut Approval checkpoint: entering stage 7 (6->7). Completed +
      -- Approved cutting record (moved here from the wrong 6-boundary check
      -- below) AND a 'First Cut Approval' QC record with result 'Pass' (new).
      IF NEW.current_stage > 6 AND OLD.current_stage <= 6 THEN
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

      -- Inline Sewing QC checkpoint: entering stage 8 (7->8). Real completed
      -- sewing work (unchanged from before) AND an 'Inline Sewing QC' record
      -- with result != 'Reject' (new — this trigger never checked QC records
      -- at all for this boundary, only the frontend did).
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

      -- Wash-Finish Approval checkpoint: entering stage 11 (10->11) — moved
      -- from the wrong 11->12 boundary this trigger previously used. Wash
      -- batch Approved (unchanged) AND a 'Wash-Finish Approval' QC record
      -- with result 'Pass' (new).
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

      -- Final AQL/Packing Audit checkpoint: entering stage 13 (12->13) — new,
      -- this trigger previously had NO check at all for dispatch. Ready
      -- carton exists AND a 'Final AQL-Packing Audit' QC record with result
      -- 'Pass' exists — mirrors checkStageAdvancement(toStage=13), which
      -- already had this check on the frontend only.
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

  DROP TRIGGER IF EXISTS trigger_enforce_order_stage_gates ON public.orders;
  CREATE TRIGGER trigger_enforce_order_stage_gates
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_order_stage_gates();
