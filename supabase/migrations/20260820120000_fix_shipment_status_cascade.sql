-- ==============================================================================
-- FIX: order status stuck after dispatch ("W102"/FF-2026-WM-02 investigation).
--
-- Two independent bugs were silently blocking the packing-list-shipped ->
-- order-status cascade:
--
-- 1. cascade_packing_list_shipped() (20260816000000_pipeline_integrity_fixes.sql)
--    only looks for a matching order WHERE o.current_stage < 13. An order
--    that was already sitting at stage 13 before its packing list actually
--    shipped (e.g. all 13 stages/QC complete, dispatch pending) is excluded
--    by that guard, so the trigger finds no order to update and silently
--    does nothing — status never flips to 'Shipped'.
--
-- 2. audit_orders_change() (20260721000000_fix_status_change_notifications.sql)
--    does a bare INSERT into public.notifications for every status change.
--    A later migration (20260816000000_pipeline_integrity_fixes.sql) added
--    a partial unique index uq_notifications_type_order ON (type, order_id)
--    WHERE read = false, intended to be paired with ON CONFLICT DO NOTHING,
--    but the trigger's INSERTs were never updated to add it. The result: if
--    an order already has ANY unread notification of the same type (e.g. a
--    previous "In Production" status_update that's still unread), the next
--    status-changing UPDATE on that order throws a unique-constraint
--    violation and the entire UPDATE — including the status change itself —
--    is rolled back. This blocks status transitions (Hold/In Production/
--    Shipped/Open) on any order with pre-existing unread notifications of
--    that same type, not just this one order.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. cascade_packing_list_shipped: match on "not already shipped" instead of
--    "still below stage 13", so an order already at stage 13 (pending
--    dispatch) still gets picked up when its packing list ships.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cascade_packing_list_shipped()
RETURNS trigger AS $$
DECLARE
  v_order_id text;
BEGIN
  IF NEW.status = 'Shipped' AND (OLD.status IS DISTINCT FROM 'Shipped') THEN
    SELECT o.order_id INTO v_order_id
    FROM public.orders o
    WHERE (
      (NEW.po_number IS NOT NULL AND o.po_number = NEW.po_number)
      OR (NEW.customer_name IS NOT NULL AND o.customer_name = NEW.customer_name)
    )
    AND o.status IS DISTINCT FROM 'Shipped'
    ORDER BY o.created_date DESC
    LIMIT 1;

    IF v_order_id IS NOT NULL THEN
      UPDATE public.cartons
        SET dispatch_status = 'Shipped'
      WHERE order_id = v_order_id
        AND dispatch_status = 'Ready';

      UPDATE public.orders
        SET current_stage = 13,
            status = 'Shipped'
      WHERE order_id = v_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. audit_orders_change: add ON CONFLICT (type, order_id) WHERE read = false
--    DO NOTHING to every notification insert, matching the partial unique
--    index so a pre-existing unread notification of the same type no longer
--    aborts the status update itself.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_orders_change()
RETURNS trigger AS $$
DECLARE
  age_days numeric;
  checkpoint_name text;
  has_qc_record boolean;
BEGIN
  IF new.status = 'On Hold' AND (old.status IS NULL OR old.status <> 'On Hold') THEN
    INSERT INTO public.notifications (message, order_id, type, stage_id, read)
    VALUES (
      '[HOLD] Order ' || new.order_id || ' has been put on hold.',
      new.order_id, 'hold', coalesce(new.current_stage, 1), false
    )
    ON CONFLICT (type, order_id) WHERE read = false DO NOTHING;
  END IF;

  IF new.status = 'In Production' AND (old.status IS NULL OR old.status <> 'In Production') THEN
    INSERT INTO public.notifications (message, order_id, type, stage_id, read)
    VALUES (
      '[UPDATE] Order ' || new.order_id || ' is now In Production.',
      new.order_id, 'status_update', coalesce(new.current_stage, 1), false
    )
    ON CONFLICT (type, order_id) WHERE read = false DO NOTHING;
  END IF;

  IF new.status = 'Shipped' AND (old.status IS NULL OR old.status <> 'Shipped') THEN
    INSERT INTO public.notifications (message, order_id, type, stage_id, read)
    VALUES (
      '[SHIPPED] Order ' || new.order_id || ' has been shipped!',
      new.order_id, 'status_update', 13, false
    )
    ON CONFLICT (type, order_id) WHERE read = false DO NOTHING;
  END IF;

  IF new.status = 'Open' AND (old.status IS NULL OR old.status <> 'Open') AND old.status IS NOT NULL THEN
    INSERT INTO public.notifications (message, order_id, type, stage_id, read)
    VALUES (
      '[UPDATE] Order ' || new.order_id || ' status changed to Open.',
      new.order_id, 'status_update', coalesce(new.current_stage, 1), false
    )
    ON CONFLICT (type, order_id) WHERE read = false DO NOTHING;
  END IF;

  age_days := extract(epoch from (now() - to_timestamp(new.created_date, 'YYYY-MM-DD'))) / 86400;

  IF new.status = 'In Production' AND new.current_stage < 13 AND age_days > 5 THEN
    INSERT INTO public.notifications (message, order_id, type, stage_id, read)
    VALUES (
      '[DELAY] Order ' || new.order_id || ' has been at Stage ' || new.current_stage || ' for over 5 days.',
      new.order_id, 'slow_stage', new.current_stage, false
    )
    ON CONFLICT (type, order_id) WHERE read = false DO NOTHING;
  END IF;

  IF new.status = 'In Production' AND new.current_stage IN (5, 8, 11, 12) AND age_days > 2 THEN
    checkpoint_name := CASE new.current_stage
      WHEN 5 THEN 'First Cut Approval'
      WHEN 8 THEN 'Inline Sewing QC'
      WHEN 11 THEN 'Wash-Finish Approval'
      WHEN 12 THEN 'Final AQL-Packing Audit'
    END;

    SELECT EXISTS (
      SELECT 1 FROM public.qc_records q
      WHERE q.order_id = new.order_id AND q.stage_checkpoint = checkpoint_name
    ) INTO has_qc_record;

    IF NOT has_qc_record THEN
      INSERT INTO public.notifications (message, order_id, type, stage_id, read)
      VALUES (
        '[QC PENDING] Order ' || new.order_id || ' at Stage ' || new.current_stage || ' for >2 days — "' || checkpoint_name || '" audit not completed.',
        new.order_id, 'qc_checkpoint_pending', new.current_stage, false
      )
      ON CONFLICT (type, order_id) WHERE read = false DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
