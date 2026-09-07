-- ==============================================================================
-- FIX: cascade_packing_list_shipped() could advance the WRONG order.
--
-- Confirmed live: dispatching Aqtiv's PO-200 packing list tried to advance a
-- completely unrelated Aqtiv order (FF-2026-00007) to Stage 13 / Shipped,
-- because this trigger's order lookup fell back to matching by customer_name
-- whenever the po_number match didn't hit:
--
--   WHERE (o.po_number = NEW.po_number) OR (o.customer_name = NEW.customer_name)
--
-- Any customer with more than one order (the normal case) makes that OR
-- ambiguous — "ORDER BY created_date DESC LIMIT 1" just picks whichever of
-- that customer's other orders happened to be created most recently, with no
-- guarantee it's the one actually being shipped. When the wrongly-picked
-- order's own gates didn't allow Stage 13 (e.g. unapproved materials), this
-- surfaced as a confusing "Order FF-2026-XXXXX has material records that are
-- not all Approved" error on the Dispatch page for an order nobody was
-- looking at. When the wrongly-picked order's gates DID happen to pass, it
-- would have silently jumped straight to Shipped without ever really being
-- packed or dispatched — silent data corruption, not just a bad error
-- message.
--
-- The identical bug was found and fixed client-side in src/routes/dispatch.tsx
-- (handleConfirmDispatchPOD) — this migration closes the same hole here,
-- since this trigger runs server-side independent of that fix and reproduces
-- the exact same symptom on its own. A shipped packing list always has a
-- po_number by this point (the app hard-blocks dispatch without one — see
-- poGateBlocked() in dispatch.tsx), so the customer_name fallback was never
-- actually needed, only dangerous.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cascade_packing_list_shipped()
RETURNS trigger AS $$
DECLARE
  v_order_id text;
BEGIN
  IF NEW.status = 'Shipped' AND (OLD.status IS DISTINCT FROM 'Shipped') THEN
    SELECT o.order_id INTO v_order_id
    FROM public.orders o
    WHERE NEW.po_number IS NOT NULL
      AND o.po_number = NEW.po_number
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
