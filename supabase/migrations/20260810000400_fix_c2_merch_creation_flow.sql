-- ==============================================================================
-- FIX C.2: MERCHANDISER CREATION FLOW (NO AUTO WORK ORDERS)
-- ==============================================================================
-- Requirement C.2 states that an order must sit in Production Scheduling first, 
-- and ONLY THEN can the system generate a Work Order (when split manually).
-- We are removing the auto-generation of Work Orders from the initial intake RPC.

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
$$ LANGUAGE plpgsql;
