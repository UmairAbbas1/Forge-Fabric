-- ==============================================================================
-- FORGE & FABRIC — SAMPLE REQUEST APPROVAL: REAL ORDER CONVERSION
-- Migration: 20260828000000_sample_order_conversion.sql
--
-- Approving a sample request today only flips status fields — no orders/
-- work_orders row is ever created, so an "approved" sample never actually
-- enters the 13-stage pipeline. This adds:
--   1. orders.is_sample / work_orders.is_sample — distinguishes sample
--      orders from bulk production everywhere they're queried.
--   2. sample_requests.rejection_reason — mirrors apply_submissions'
--      existing column so a sample rejection reason has somewhere real to
--      live (previously nowhere on this table).
--   3. convert_sample_to_work_order() — a NEW, separate RPC (does not
--      touch convert_submission_to_blanket_po). Reads real quantity/size
--      breakdown from either sample_requests (the live source of today's
--      real sample data) or apply_submissions (the customer-portal sample
--      intake path, currently 0 live rows but real code), and writes an
--      actual, stage-trackable orders + work_orders row with a SMP- prefix
--      instead of PO-/WO-, current_stage = 1, is_sample = true. Follows the
--      same single-transaction discipline as convert_submission_to_blanket_po
--      (FOR UPDATE row lock, all-or-nothing).
-- Idempotent throughout.
-- ==============================================================================

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.work_orders
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.sample_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE OR REPLACE FUNCTION public.convert_sample_to_work_order(
  p_sample_id uuid,
  p_source_table text DEFAULT 'sample_requests'
)
RETURNS jsonb AS $$
DECLARE
  v_company_name text;
  v_size_breakdown jsonb;
  v_qty int := 0;
  v_style_name text;
  v_status text;
  v_size_str text;
  v_order_id text;
  v_seq int;
BEGIN
  IF p_source_table = 'sample_requests' THEN
    -- sample_requests has no 'converted' status value (see the terminal-
    -- state UPDATE below), so the duplicate-conversion guard checks
    -- sample_status instead — status alone can never detect this here.
    SELECT c.name, sr.size_breakdown, sr.quantity, sr.sample_type, sr.sample_status
      INTO v_company_name, v_size_breakdown, v_qty, v_style_name, v_status
    FROM public.sample_requests sr
    LEFT JOIN public.companies c ON c.id = sr.company_id
    WHERE sr.id = p_sample_id
    FOR UPDATE OF sr;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sample request % not found', p_sample_id;
    END IF;
    IF v_status = 'Converted_To_Bulk' THEN
      RAISE EXCEPTION 'Sample % has already been converted to a production order', p_sample_id;
    END IF;

  ELSIF p_source_table = 'apply_submissions' THEN
    SELECT company_name,
           COALESCE(
             (style_blocks->0->'size_matrix'),
             (style_blocks->0->'size_quantities'),
             '{}'::jsonb
           ),
           0,
           COALESCE(style_blocks->0->>'style_name', product_type),
           status
      INTO v_company_name, v_size_breakdown, v_qty, v_style_name, v_status
    FROM public.apply_submissions
    WHERE id = p_sample_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sample submission % not found', p_sample_id;
    END IF;
    IF v_status = 'converted' THEN
      RAISE EXCEPTION 'Sample % has already been converted to a production order', p_sample_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid source_table: % (expected sample_requests or apply_submissions)', p_source_table;
  END IF;

  IF v_company_name IS NULL OR btrim(v_company_name) = '' THEN
    RAISE EXCEPTION 'Could not resolve a company name for sample %', p_sample_id;
  END IF;

  -- No hardcoded fallback quantity: sum the real size breakdown if the
  -- quantity column itself is unset, and refuse to create a zero-unit order
  -- rather than inventing a number.
  IF v_qty IS NULL OR v_qty = 0 THEN
    SELECT COALESCE(SUM(value::int), 0) INTO v_qty
    FROM jsonb_each_text(COALESCE(v_size_breakdown, '{}'::jsonb));
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'Sample % has no real quantity or size breakdown on file — refusing to create a zero-unit order', p_sample_id;
  END IF;

  SELECT string_agg(key || ':' || value, ', ' ORDER BY key)
    INTO v_size_str
  FROM jsonb_each_text(COALESCE(v_size_breakdown, '{}'::jsonb));

  v_seq := nextval('public.apply_ref_seq');
  v_order_id := 'SMP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::text, 5, '0');

  INSERT INTO public.orders (
    order_id, customer_name, po_number, tech_pack_ref, size_breakdown,
    status, created_date, current_stage, qty, style_no, style_description,
    is_sample, notes
  ) VALUES (
    v_order_id, v_company_name, v_order_id, 'TP-' || v_order_id, COALESCE(v_size_str, ''),
    'Open', CURRENT_DATE, 1, v_qty, COALESCE(v_style_name, 'Sample'),
    'Sample Order — ' || COALESCE(v_style_name, 'Sample'),
    TRUE, 'Converted from sample request (' || p_source_table || ': ' || p_sample_id::text || ')'
  );

  INSERT INTO public.work_orders (
    wo_number, order_type, priority, style_name, colorway, wash_process_type,
    target_qty, size_breakdown, current_stage_id, status, is_sample
  ) VALUES (
    v_order_id, 'Sample', 'Normal', COALESCE(v_style_name, 'Sample'), '', '',
    v_qty, COALESCE(v_size_breakdown, '{}'::jsonb), 1, 'Open', TRUE
  );

  IF p_source_table = 'sample_requests' THEN
    -- sample_requests.status has its own CHECK constraint (submitted /
    -- factory_review / cost_approval / waiting_materials / in_production /
    -- shipped / received / approved / rejected) with no 'converted' value —
    -- sample_status is the real REQ-04 lifecycle field for this terminal
    -- state, so status is deliberately left at whatever it already was
    -- (normally 'approved') rather than forced into an invalid value.
    UPDATE public.sample_requests
    SET sample_status = 'Converted_To_Bulk', approved_at = NOW()
    WHERE id = p_sample_id;
  ELSE
    UPDATE public.apply_submissions
    SET status = 'converted', sample_status = 'Converted_To_Bulk'
    WHERE id = p_sample_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'wo_number', v_order_id,
    'qty', v_qty,
    'customer_name', v_company_name,
    'size_breakdown', v_size_str
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.convert_sample_to_work_order(uuid, text) TO authenticated;
