-- ==============================================================================
-- FORGE & FABRIC — Real raw-material consumption tracking + shortage holds
-- Migration: 20260901001600_real_material_consumption_and_shortage_holds.sql
-- ==============================================================================
--
-- ROOT CAUSE CONFIRMED LIVE (via direct REST probing of the production DB,
-- not just the migration files, which had drifted from what's actually
-- deployed): cutting.tsx's consumption-recording insert into
-- inventory_issuances sends `quantity_issued`, but the live table only ever
-- had `qty_issued` — every cut ticket's material issuance insert has been
-- silently failing (caught + console.warn'd) since the feature was built.
-- Nothing has ever recorded real consumption, so `inventory_lots` balances
-- have never reflected real usage either. This migration fixes the schema
-- and the deduction trigger; a companion code change in cutting.tsx (same
-- PR) switches the insert to the real column names and adds a direct
-- order_id link instead of relying only on lot/description string-parsing.

-- ---------------------------------------------------------------------------
-- 1. inventory_issuances: add the direct order_id link cutting.tsx needs to
--    record "this much material was used against THIS order" without relying
--    on the fragile materials.description "(Lot: X)" string-parse fallback
--    that cutting.tsx's own comments already flag as a workaround.
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_issuances
  ADD COLUMN IF NOT EXISTS order_id text;

CREATE INDEX IF NOT EXISTS idx_inventory_issuances_order_id ON public.inventory_issuances(order_id);

-- ---------------------------------------------------------------------------
-- 2. Fix the deduction trigger: it has always keyed off inventory_item_id,
--    which nothing in this app has ever populated. The actual write path
--    (cutting.tsx) sets lot_id + qty_issued — deduct inventory_lots.
--    quantity_on_hand from there. The legacy inventory_item_id/
--    material_requisition_id branches are left in place (harmless, unused)
--    for any future writer that does populate them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_deduct_inventory_on_issuance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lot_id IS NOT NULL THEN
    UPDATE public.inventory_lots
    SET quantity_on_hand = GREATEST(0, quantity_on_hand - COALESCE(NEW.qty_issued, 0)),
        updated_at = NOW()
    WHERE id = NEW.lot_id;
  END IF;

  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory_items
    SET quantity_on_hand = quantity_on_hand - NEW.qty_issued
    WHERE id = NEW.inventory_item_id;
  END IF;

  IF NEW.material_requisition_id IS NOT NULL THEN
    UPDATE public.material_requisitions
    SET qty_issued = qty_issued + NEW.qty_issued
    WHERE id = NEW.material_requisition_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger already exists (trg_deduct_inventory, from 20260810000000) pointing
-- at this function name — CREATE OR REPLACE above is enough, no re-attach needed.

-- ---------------------------------------------------------------------------
-- 3. orders: real hold state. status already supports free-text values (no
--    CHECK constraint) and 'On Hold' is already a real, used value
--    (useAppData.isOrderOnHold/updateOrder) — just add the reason + timestamp
--    so a hold this migration creates is diagnosable, not silent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS held_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. notification_logs: add an order-scoped link alongside the existing
--    submission/update-request links (additive — doesn't touch either
--    existing FK), so shortage notices can reference the actual order
--    without inventing a second notification table.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS related_order_id text;

-- ---------------------------------------------------------------------------
-- 5. Real per-order material balance: received (approved GRN qty from the
--    existing `materials` table) vs. used (real inventory_issuances rows,
--    now that they actually get written) vs. remaining. No parallel
--    tracking system — both source tables already exist and are already
--    real, live data once the write path above is fixed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.order_material_balance AS
SELECT
  o.order_id,
  COALESCE(recv.qty_received, 0) AS qty_received,
  COALESCE(used.qty_used, 0) AS qty_used,
  COALESCE(recv.qty_received, 0) - COALESCE(used.qty_used, 0) AS qty_remaining
FROM public.orders o
LEFT JOIN (
  SELECT order_id, SUM(qty_received) AS qty_received
  FROM public.materials
  WHERE inspection_status = 'Approved'
  GROUP BY order_id
) recv ON recv.order_id = o.order_id
LEFT JOIN (
  SELECT order_id, SUM(qty_issued) AS qty_used
  FROM public.inventory_issuances
  WHERE order_id IS NOT NULL
  GROUP BY order_id
) used ON used.order_id = o.order_id;

GRANT SELECT ON public.order_material_balance TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 6. Shortage detection + hold + notifications. Fires whenever a real
--    issuance is recorded against an order (i.e. every successful cut
--    ticket once the write path above works). Shortage signal is real
--    consumption exceeding real approved receipts for that order — no
--    invented BOM/consumption-norm system, since none exists anywhere in
--    this codebase today (material_requisitions.qty_required is defined in
--    the schema but is never written to by any part of the app).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_material_shortage_and_hold(p_order_id text)
RETURNS boolean AS $$
DECLARE
  v_remaining numeric;
  v_short numeric;
  v_current_status text;
  v_reference_code text;
  v_customer_email text;
  v_company_name text;
  v_staff RECORD;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT qty_remaining INTO v_remaining
  FROM public.order_material_balance
  WHERE order_id = p_order_id;

  IF v_remaining IS NULL OR v_remaining >= 0 THEN
    RETURN false;
  END IF;

  SELECT status, apply_reference_code INTO v_current_status, v_reference_code
  FROM public.orders WHERE order_id = p_order_id;

  -- Already on hold — don't re-fire duplicate notifications on every
  -- subsequent issuance against the same still-short order.
  IF v_current_status = 'On Hold' THEN
    RETURN false;
  END IF;

  v_short := ABS(v_remaining);

  IF v_reference_code IS NOT NULL THEN
    SELECT contact_email, company_name INTO v_customer_email, v_company_name
    FROM public.apply_submissions WHERE apply_reference_code = v_reference_code
    LIMIT 1;
  END IF;

  UPDATE public.orders
  SET status = 'On Hold',
      hold_reason = format('Insufficient raw material to complete this order — short by %s units against what has been received and approved. Additional material must be received and the hold explicitly released before production can resume.', v_short),
      held_at = NOW()
  WHERE order_id = p_order_id;

  IF v_customer_email IS NOT NULL THEN
    INSERT INTO public.notification_logs (recipient_email, notification_type, subject, body, related_order_id)
    VALUES (
      v_customer_email,
      'material_shortage_hold',
      format('Your order %s is temporarily on hold', p_order_id),
      format('We''ve paused production on your order (%s) while we source additional material to complete it. We''ll resume as soon as the material is received and confirmed — no action is needed from you right now. We''ll keep you updated on timing.', p_order_id),
      p_order_id
    );
  END IF;

  FOR v_staff IN
    SELECT email FROM public.profiles WHERE role IN ('merchandiser', 'admin') AND email IS NOT NULL
  LOOP
    INSERT INTO public.notification_logs (recipient_email, notification_type, subject, body, related_order_id)
    VALUES (
      v_staff.email,
      'material_shortage_hold',
      format('[ACTION NEEDED] Order %s on hold — material shortage', p_order_id),
      format('Order %s has been placed on hold: short by %s units of raw material against what has been received and approved. Order additional material and release the hold once it is received and logged.', p_order_id, v_short),
      p_order_id
    );
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_check_shortage_after_issuance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    PERFORM public.check_material_shortage_and_hold(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_shortage_after_issuance ON public.inventory_issuances;
CREATE TRIGGER trg_check_shortage_after_issuance
AFTER INSERT ON public.inventory_issuances
FOR EACH ROW EXECUTE FUNCTION public.trigger_check_shortage_after_issuance();

-- Also re-check whenever new material is received/approved for an order
-- already on hold for this reason, so a still-short order surfaces its
-- updated shortfall rather than silently sitting stale (does NOT
-- auto-release the hold — see release_material_hold below for why that
-- stays an explicit, deliberate staff action).
CREATE OR REPLACE FUNCTION public.trigger_check_shortage_after_material_update() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL AND NEW.inspection_status = 'Approved' THEN
    PERFORM public.check_material_shortage_and_hold(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_shortage_after_material_update ON public.materials;
CREATE TRIGGER trg_check_shortage_after_material_update
AFTER INSERT OR UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.trigger_check_shortage_after_material_update();

-- ---------------------------------------------------------------------------
-- 7. Hold release — explicit, staff-only action (the safer option: a
--    shortage hold never silently auto-resumes just because a balance
--    check happens to pass at some point; a human confirms the received
--    material is actually correct/usable and consciously resumes
--    production). Re-verifies the balance server-side rather than trusting
--    the caller, so it can't be released while still genuinely short.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_material_hold(p_order_id text)
RETURNS void AS $$
DECLARE
  v_remaining numeric;
  v_role text;
  v_reference_code text;
  v_customer_email text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'merchandiser', 'production') THEN
    RAISE EXCEPTION 'Only internal staff can release a material hold.';
  END IF;

  SELECT qty_remaining INTO v_remaining FROM public.order_material_balance WHERE order_id = p_order_id;
  IF v_remaining IS NULL OR v_remaining < 0 THEN
    RAISE EXCEPTION 'Cannot release hold — order % is still short by % units. Receive and approve the additional material first.', p_order_id, ABS(COALESCE(v_remaining, 0));
  END IF;

  SELECT apply_reference_code INTO v_reference_code FROM public.orders WHERE order_id = p_order_id;

  UPDATE public.orders
  SET status = 'In Production', hold_reason = NULL, held_at = NULL
  WHERE order_id = p_order_id AND status = 'On Hold';

  IF v_reference_code IS NOT NULL THEN
    SELECT contact_email INTO v_customer_email FROM public.apply_submissions WHERE apply_reference_code = v_reference_code LIMIT 1;
    IF v_customer_email IS NOT NULL THEN
      INSERT INTO public.notification_logs (recipient_email, notification_type, subject, body, related_order_id)
      VALUES (
        v_customer_email,
        'material_shortage_resolved',
        format('Your order %s has resumed production', p_order_id),
        format('Good news — the material shortage on your order (%s) has been resolved and production has resumed.', p_order_id),
        p_order_id
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.release_material_hold(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_material_shortage_and_hold(text) TO authenticated, anon;
