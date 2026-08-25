-- ==============================================================================
-- Customer-review-and-approval step for merchandiser/admin-created orders
-- (Internal Order Intake, /apply-intake, when the submitter is staff, not
-- the customer themselves). The public self-submission flow (/apply/new,
-- and /apply-intake when a customer submits their own order) is completely
-- unaffected by this migration — every change here is additive (new
-- column, new narrowly-scoped SELECT policies for two tables). Nothing
-- existing is altered or dropped.
-- ==============================================================================

-- Who authored this submission internally (NULL for every customer-authored
-- row, exactly as today) — lets the app notify the right merchandiser back
-- when the customer approves/rejects, and show "awaiting customer" vs
-- "customer rejected" in that merchandiser's own Submissions Inbox.
ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apply_submissions_created_by_staff
  ON public.apply_submissions(created_by_staff_id);

-- apply_submissions.status has no CHECK constraint (see the column comment
-- in 20260714000400_apply_portal_schema.sql) — 'pending_customer_review'
-- and 'customer_rejected' are new documented values, added the same
-- unconstrained way 'converted'/'rejected'/'needs_info' were.

-- The customer's read-only review screen needs to see the cut sheet and
-- documents the merchandiser entered on their behalf — both tables are
-- staff-only today (apply_cut_sheets_staff_all / apply_documents_staff_all,
-- both `USING (is_internal_staff())`). These two additive SELECT grants let
-- a customer read a cut sheet/document only when: it belongs to a
-- submission for THEIR OWN company, AND that submission is actually in the
-- customer-review lifecycle right now (pending_customer_review while
-- awaiting their decision, or customer_rejected so they can still see what
-- they rejected). Submissions in every other status (pending_review,
-- under_review, needs_info, the normal staff-only queue) remain completely
-- inaccessible to customers, exactly as before this migration.
DROP POLICY IF EXISTS "apply_cut_sheets_customer_review_select" ON public.apply_cut_sheets;
CREATE POLICY "apply_cut_sheets_customer_review_select" ON public.apply_cut_sheets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.id = apply_cut_sheets.submission_id
        AND s.status IN ('pending_customer_review', 'customer_rejected')
        AND lower(s.company_name) = lower(c.name)
    )
  );

DROP POLICY IF EXISTS "apply_documents_customer_review_select" ON public.apply_documents;
CREATE POLICY "apply_documents_customer_review_select" ON public.apply_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.id = apply_documents.submission_id
        AND s.status IN ('pending_customer_review', 'customer_rejected')
        AND lower(s.company_name) = lower(c.name)
    )
  );

-- A customer reviewing an internally-created submission needs to see who
-- entered it, so the review screen (and any future "created by") can show
-- a real name rather than nothing — narrow, read-only, and only for
-- submissions actually in the customer-review lifecycle for their company.
DROP POLICY IF EXISTS "profiles_customer_review_staff_select" ON public.profiles;
CREATE POLICY "profiles_customer_review_staff_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.created_by_staff_id = profiles.id
        AND s.status IN ('pending_customer_review', 'customer_rejected')
        AND lower(s.company_name) = lower(c.name)
    )
  );

-- ==============================================================================
-- Approve/reject RPCs for the customer review step. A customer cannot be
-- given direct RLS write access to apply_submissions/blanket_pos/orders for
-- this (those stay staff-only, exactly as before this migration — see
-- apply_submissions_staff_update, orders_staff_write, etc., all untouched).
-- Instead, two SECURITY DEFINER functions do the privileged writes on the
-- caller's behalf, but only after verifying — inside the function itself,
-- since SECURITY DEFINER bypasses RLS — that the caller is a real customer
-- whose own company owns a submission that is actually
-- pending_customer_review. Internal staff callers are completely unaffected:
-- convert_submission_to_blanket_po's own logic and signature are unchanged,
-- it just now also accepts a second, narrower category of authorized caller.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.convert_submission_to_blanket_po(
    p_submission_id UUID,
    p_custom_po_number TEXT DEFAULT NULL,
    p_override_total_qty INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_cust_id UUID;
    v_po_id UUID;
    v_po_num VARCHAR(50);
    v_total_qty INT := 0;
BEGIN
    -- 1. Load submission
    SELECT * INTO v_sub FROM public.apply_submissions WHERE id = p_submission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission % not found', p_submission_id;
    END IF;

    -- Authorization: internal staff (unchanged, always allowed), OR the
    -- authenticated customer whose own company owns this submission AND it
    -- is genuinely awaiting their review right now.
    IF NOT (
      public.is_internal_staff()
      OR (
        v_sub.status = 'pending_customer_review'
        AND EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.id = public.get_auth_user_company_id()
          AND lower(c.name) = lower(v_sub.company_name)
        )
      )
    ) THEN
      RAISE EXCEPTION 'Not authorized to convert this submission';
    END IF;

    IF v_sub.status = 'converted' THEN
        RAISE EXCEPTION 'Submission % has already been converted to PO %', p_submission_id, v_sub.converted_to_po_id;
    END IF;

    -- 2. Find or create Customer
    SELECT id INTO v_cust_id FROM public.customers WHERE name ILIKE v_sub.company_name LIMIT 1;
    IF v_cust_id IS NULL THEN
        INSERT INTO public.customers (name)
        VALUES (v_sub.company_name)
        RETURNING id INTO v_cust_id;
    END IF;

    -- 3. Calculate total units if not provided
    IF p_override_total_qty IS NOT NULL AND p_override_total_qty > 0 THEN
        v_total_qty := p_override_total_qty;
    ELSE
        -- Sum up units across all linked cut sheets
        SELECT COALESCE(SUM((c->>'total_units')::int), 100)
        INTO v_total_qty
        FROM public.apply_cut_sheets cs,
             jsonb_array_elements(cs.sheet_data->'components') AS c
        WHERE cs.submission_id = p_submission_id;

        IF v_total_qty IS NULL OR v_total_qty = 0 THEN
            v_total_qty := 100;
        END IF;
    END IF;

    -- 4. Generate PO Number
    IF p_custom_po_number IS NOT NULL AND p_custom_po_number <> '' THEN
        v_po_num := p_custom_po_number;
    ELSE
        v_po_num := 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.apply_ref_seq')::TEXT, 4, '0');
    END IF;

    -- 5. Insert Blanket PO ONLY (Removed Work Order auto-generation)
    INSERT INTO public.blanket_pos (
        po_number,
        customer_id,
        customer_type,
        total_contract_qty,
        fulfilled_qty,
        po_type,
        source_submission_id,
        apply_reference_code,
        client_submitted
    ) VALUES (
        v_po_num,
        v_cust_id,
        'External',
        v_total_qty,
        0,
        'Blanket',
        p_submission_id,
        v_sub.apply_reference_code,
        TRUE
    ) RETURNING id INTO v_po_id;

    -- Link cut sheets to the new PO instead of Work Orders
    UPDATE public.apply_cut_sheets
    SET work_order_id = NULL, is_current = TRUE
    WHERE submission_id = p_submission_id;

    -- 6. Mark submission as converted
    UPDATE public.apply_submissions
    SET status = 'converted',
        converted_to_po_id = v_po_id
    WHERE id = p_submission_id;

    -- 7. Return Result (without work_orders array)
    RETURN jsonb_build_object(
        'po_id', v_po_id,
        'po_number', v_po_num
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Single entry point the customer review screen calls for both Approve and
-- Reject. Every privileged write here happens only after the same
-- authorization check: caller is a real customer profile, their own
-- company owns this submission, and it is currently pending_customer_review.
CREATE OR REPLACE FUNCTION public.customer_review_decision(
  p_submission_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sub RECORD;
  v_caller RECORD;
  v_caller_company_name TEXT;
  v_staff_email TEXT;
  v_staff_name TEXT;
  v_convert_result JSONB;
  v_main_style JSONB;
  v_size_breakdown JSONB;
  v_cut_sheet RECORD;
  v_total_qty INT := 0;
  v_order_id TEXT;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: must be approve or reject';
  END IF;
  IF p_action = 'reject' AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'A reason is required to request changes.';
  END IF;

  SELECT id, role, company_id INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role <> 'customer' OR v_caller.company_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized: a customer account is required.';
  END IF;

  SELECT name INTO v_caller_company_name FROM public.companies WHERE id = v_caller.company_id;

  SELECT * INTO v_sub FROM public.apply_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found.';
  END IF;
  IF v_caller_company_name IS NULL OR lower(v_caller_company_name) <> lower(v_sub.company_name) THEN
    RAISE EXCEPTION 'Not authorized: this submission does not belong to your company.';
  END IF;
  IF v_sub.status <> 'pending_customer_review' THEN
    RAISE EXCEPTION 'This submission is not awaiting your review (current status: %).', v_sub.status;
  END IF;

  IF v_sub.created_by_staff_id IS NOT NULL THEN
    SELECT email, full_name INTO v_staff_email, v_staff_name
    FROM public.profiles WHERE id = v_sub.created_by_staff_id;
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.apply_submissions
    SET status = 'customer_rejected',
        rejection_reason = p_reason,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_submission_id;

    IF v_staff_email IS NOT NULL THEN
      INSERT INTO public.notification_logs
        (recipient_email, notification_type, subject, body, related_submission_id, sent_at, delivered, opened)
      VALUES (
        v_staff_email,
        'customer_rejected_intake',
        'Customer requested changes: ' || COALESCE(v_sub.apply_reference_code, v_sub.id::text),
        'Dear ' || COALESCE(v_staff_name, 'Team Member') || E',\n\n' || v_sub.company_name ||
          ' reviewed the order you submitted on their behalf (' || COALESCE(v_sub.apply_reference_code, '') ||
          ') and requested changes rather than approving it.' || E'\n\nReason: ' || p_reason ||
          E'\n\nPlease revise the details and resend it for their review.',
        p_submission_id, NOW(), TRUE, FALSE
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'reject', 'status', 'customer_rejected');
  END IF;

  -- Approve: PO number must be a real merchandiser-supplied reference —
  -- this codebase never synthesizes PO numbers (see ConversionModal's own
  -- required-field validation), and useApplySubmission.ts only ever routes
  -- a submission into pending_customer_review when this field is already
  -- present, so this should never be empty here.
  IF v_sub.existing_order_reference IS NULL OR length(trim(v_sub.existing_order_reference)) = 0 THEN
    RAISE EXCEPTION 'This submission is missing a required PO reference and cannot be approved yet. Please contact your merchandiser.';
  END IF;

  v_convert_result := public.convert_submission_to_blanket_po(p_submission_id, v_sub.existing_order_reference, NULL);

  -- Create the real, pipeline-visible order at stage 1 — mirrors what
  -- useConvertSubmission's addOrder() does for a staff-approved conversion,
  -- since convert_submission_to_blanket_po only creates the Blanket PO.
  v_main_style := COALESCE((v_sub.style_blocks -> 0), '{}'::jsonb);
  SELECT * INTO v_cut_sheet FROM public.apply_cut_sheets WHERE submission_id = p_submission_id LIMIT 1;

  v_size_breakdown := COALESCE(
    NULLIF(v_main_style -> 'size_matrix', 'null'::jsonb),
    v_cut_sheet.sheet_data -> 'components' -> 0 -> 'size_matrix',
    '{}'::jsonb
  );

  SELECT COALESCE(SUM(value::text::int), 0) INTO v_total_qty
  FROM jsonb_each(v_size_breakdown);
  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'This submission is missing a size matrix and cannot be approved yet. Please contact your merchandiser.';
  END IF;

  v_order_id := 'FF-' || floor(2000 + random() * 7999)::int;

  INSERT INTO public.orders (
    order_id, customer_name, po_number, tech_pack_ref, size_breakdown, qty,
    status, current_stage, created_date, style_no, style_description, color,
    planned_ship_date, material_status, notes,
    selected_stages, priority, rush_multiplier
  ) VALUES (
    v_order_id,
    v_sub.company_name,
    COALESCE(v_convert_result->>'po_number', v_sub.existing_order_reference),
    'TP-' || COALESCE(v_main_style->>'style_name', v_main_style->>'style_number', v_sub.apply_reference_code),
    NULLIF((SELECT string_agg(key, '-' ORDER BY key) FROM jsonb_each(v_size_breakdown)), ''),
    v_total_qty,
    'Open',
    1,
    NOW(),
    COALESCE(v_main_style->>'style_number', v_main_style->>'style_name', v_cut_sheet.style_no),
    v_main_style->>'style_name',
    v_main_style->>'colorway',
    v_sub.planned_ship_date,
    'Pending',
    'Converted from Internal Order Intake submission ' || COALESCE(v_sub.apply_reference_code, '') || ', approved by customer.',
    COALESCE(v_sub.requested_stages, '{1,2,3,4,5,6,7,8,9,10,11,12,13}'::int[]),
    v_sub.priority,
    v_sub.rush_multiplier
  );

  IF v_staff_email IS NOT NULL THEN
    INSERT INTO public.notification_logs
      (recipient_email, notification_type, subject, body, related_submission_id, sent_at, delivered, opened)
    VALUES (
      v_staff_email,
      'customer_approved_intake',
      'Customer approved: ' || COALESCE(v_sub.apply_reference_code, v_sub.id::text),
      'Dear ' || COALESCE(v_staff_name, 'Team Member') || E',\n\n' || v_sub.company_name ||
        ' approved the order you submitted on their behalf (' || COALESCE(v_sub.apply_reference_code, '') ||
        '). It has been converted to Blanket PO ' || (v_convert_result->>'po_number') || ' and Order ' || v_order_id ||
        ', now active in the production pipeline at Stage 1.',
      p_submission_id, NOW(), TRUE, FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'action', 'approve', 'status', 'converted',
    'po_number', v_convert_result->>'po_number', 'order_id', v_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.customer_review_decision(UUID, TEXT, TEXT) TO authenticated;
