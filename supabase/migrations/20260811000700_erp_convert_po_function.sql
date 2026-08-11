-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 7: ATOMIC PO TO WORK ORDER CONVERSION RPC
-- Migration: 20260811000700_erp_convert_po_function.sql
-- Implements Blueprint Flow C: Validates BOM & Size Ranges, creates WOs & Requisitions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.convert_po_to_work_orders(p_po_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
    v_bom RECORD;
    v_wo_id UUID;
    v_wo_number VARCHAR(100);
    v_wo_counter INT := 1;
    v_created_wos JSONB := '[]'::jsonb;
    v_validation_errors JSONB := '[]'::jsonb;
    v_missing_boms INT := 0;
    v_total_req_created INT := 0;
    v_req_qty NUMERIC(12,2);
BEGIN
    -- 1. Load Purchase Order with lock
    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Purchase Order ' || p_po_id || ' not found',
            'work_orders', '[]'::jsonb,
            'errors', jsonb_build_array('PO record not found')
        );
    END IF;

    IF v_po.status = 'In_Production' OR v_po.status = 'Completed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Purchase Order ' || v_po.po_number || ' has already been converted to production',
            'work_orders', '[]'::jsonb,
            'errors', jsonb_build_array('PO status is ' || v_po.status)
        );
    END IF;

    -- 2. VALIDATION PHASE: Ensure all PO line items have an assigned Size Range & at least 1 BOM recipe
    FOR v_item IN 
        SELECT 
            pli.id as po_line_item_id,
            pli.ordered_qty,
            s.id as sku_id,
            s.colorway,
            s.size_code,
            st.id as style_id,
            st.style_code,
            st.style_name,
            st.size_range_id
        FROM public.po_line_items pli
        JOIN public.skus s ON s.id = pli.sku_id
        JOIN public.styles st ON st.id = s.style_id
        WHERE pli.po_id = p_po_id
    LOOP
        -- Check Size Range assignment
        IF v_item.size_range_id IS NULL THEN
            v_validation_errors := v_validation_errors || jsonb_build_object(
                'po_line_item_id', v_item.po_line_item_id,
                'style_code', v_item.style_code,
                'error', 'Style ' || v_item.style_name || ' (' || v_item.style_code || ') is missing an assigned Size Range'
            );
        END IF;

        -- Check BOM existence for this style and colorway
        IF NOT EXISTS (
            SELECT 1 FROM public.boms 
            WHERE style_id = v_item.style_id 
            AND (colorway = v_item.colorway OR colorway = 'ALL')
        ) THEN
            v_missing_boms := v_missing_boms + 1;
            v_validation_errors := v_validation_errors || jsonb_build_object(
                'po_line_item_id', v_item.po_line_item_id,
                'style_code', v_item.style_code,
                'colorway', v_item.colorway,
                'error', 'No approved BOM recipe found for Style ' || v_item.style_code || ' and Colorway ' || v_item.colorway
            );
        END IF;
    END LOOP;

    -- If validation failed, ROLLBACK implicitly by returning failure JSON before mutations
    IF jsonb_array_length(v_validation_errors) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Validation failed: Cannot convert PO to Work Orders due to missing BOM recipes or Size Ranges',
            'work_orders', '[]'::jsonb,
            'errors', v_validation_errors
        );
    END IF;

    -- 3. EXECUTION PHASE: Atomic Work Order & Material Requisition Generation
    FOR v_item IN 
        SELECT 
            pli.id as po_line_item_id,
            pli.ordered_qty,
            s.id as sku_id,
            s.colorway,
            s.size_code,
            st.id as style_id,
            st.style_code,
            st.style_name
        FROM public.po_line_items pli
        JOIN public.skus s ON s.id = pli.sku_id
        JOIN public.styles st ON st.id = s.style_id
        WHERE pli.po_id = p_po_id
    LOOP
        v_wo_number := 'WO-' || v_po.po_number || '-' || LPAD(v_wo_counter::text, 3, '0');

        -- Create Work Order
        INSERT INTO public.work_orders (
            po_line_item_id,
            wo_number,
            style_name, -- Populate legacy for fallback compatibility
            colorway,
            target_qty,
            starting_stage_id,
            current_stage_id,
            status,
            due_date
        ) VALUES (
            v_item.po_line_item_id,
            v_wo_number,
            v_item.style_name,
            v_item.colorway,
            v_item.ordered_qty,
            1, -- Stage 1: Order Intake / Release
            1,
            'Open',
            v_po.delivery_due_date
        ) RETURNING id INTO v_wo_id;

        v_wo_counter := v_wo_counter + 1;

        -- Generate Material Requisitions from BOM
        FOR v_bom IN 
            SELECT 
                b.item_id,
                b.consumption_qty,
                b.unit_of_measure,
                b.waste_allowance_pct,
                i.item_name,
                i.category
            FROM public.boms b
            JOIN public.inventory_items i ON i.id = b.item_id
            WHERE b.style_id = v_item.style_id 
            AND (b.colorway = v_item.colorway OR b.colorway = 'ALL')
        LOOP
            -- Calculate: consumption_qty * ordered_qty * (1 + waste_allowance_pct / 100)
            v_req_qty := ROUND(
                (v_bom.consumption_qty * v_item.ordered_qty * (1.00 + (v_bom.waste_allowance_pct / 100.00)))::numeric, 
                2
            );

            INSERT INTO public.material_requisitions (
                work_order_id,
                material_category,
                material_name,
                qty_required,
                qty_issued,
                unit,
                facility,
                status
            ) VALUES (
                v_wo_id,
                v_bom.category,
                v_bom.item_name,
                v_req_qty,
                0,
                v_bom.unit_of_measure,
                'Sewing Facility',
                'Pending'
            );

            v_total_req_created := v_total_req_created + 1;
        END LOOP;

        v_created_wos := v_created_wos || jsonb_build_object(
            'work_order_id', v_wo_id,
            'wo_number', v_wo_number,
            'style_code', v_item.style_code,
            'colorway', v_item.colorway,
            'size_code', v_item.size_code,
            'target_qty', v_item.ordered_qty
        );
    END LOOP;

    -- Update PO Status to In_Production
    UPDATE public.purchase_orders
    SET status = 'In_Production', updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully generated ' || (v_wo_counter - 1) || ' Work Orders and ' || v_total_req_created || ' Material Requisitions',
        'work_orders', v_created_wos,
        'errors', '[]'::jsonb
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Unhandled database exception during conversion: ' || SQLERRM,
        'work_orders', '[]'::jsonb,
        'errors', jsonb_build_array(SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
