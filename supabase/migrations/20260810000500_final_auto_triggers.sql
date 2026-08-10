-- ==============================================================================
-- FIX DEEP INTEGRATION GAPS (A.1, E.1)
-- ==============================================================================

-- 1. Ensure blanket_pos has a status column so we can close it
ALTER TABLE public.blanket_pos ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Open';

-- 2. Trigger for E.1: Auto-Invoice Flag & A.1: Auto-Fulfill Parent PO
CREATE OR REPLACE FUNCTION public.trigger_wo_completion_hooks() RETURNS TRIGGER AS $$
DECLARE
  v_po_fulfilled INT;
  v_po_total INT;
  v_auto_close BOOLEAN;
BEGIN
  -- If advancing to Stage 12 (Ready for Delivery) or 13 (Invoiced)
  IF NEW.current_stage_id >= 12 AND OLD.current_stage_id < 12 THEN
    
    -- E.1: Auto-flag for invoicing
    NEW.ready_for_invoice := TRUE;

    -- A.1: Auto-fulfill the parent PO
    IF NEW.blanket_po_id IS NOT NULL THEN
      -- Add to fulfilled_qty
      UPDATE public.blanket_pos
      SET fulfilled_qty = fulfilled_qty + NEW.target_qty
      WHERE id = NEW.blanket_po_id
      RETURNING fulfilled_qty, total_contract_qty, auto_close_on_fulfill 
      INTO v_po_fulfilled, v_po_total, v_auto_close;

      -- If fully fulfilled and auto-close is enabled, mark PO as Closed
      IF v_auto_close = TRUE AND v_po_fulfilled >= v_po_total THEN
        UPDATE public.blanket_pos
        SET status = 'Closed'
        WHERE id = NEW.blanket_po_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wo_completion_hooks ON public.work_orders;
CREATE TRIGGER trg_wo_completion_hooks
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_wo_completion_hooks();
