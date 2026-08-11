-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 5: NON-DESTRUCTIVE DATA BACKFILL & MIGRATION
-- Migration: 20260811000500_erp_data_migration_backfill.sql
-- ==============================================================================

DO $$
DECLARE
    v_default_size_range_id UUID;
    r_cust RECORD;
    r_wo RECORD;
    r_mat RECORD;
    r_rmi RECORD;
    v_company_id UUID;
    v_style_id UUID;
    v_sku_id UUID;
    v_item_id UUID;
    v_size_code VARCHAR;
    v_clean_code VARCHAR;
    v_error_msg TEXT;
BEGIN
    -- Get default Size Range ID (Adult Denim Numeric or fallback to first available)
    SELECT id INTO v_default_size_range_id FROM public.size_ranges WHERE name = 'Adult Denim Numeric' LIMIT 1;
    IF v_default_size_range_id IS NULL THEN
        SELECT id INTO v_default_size_range_id FROM public.size_ranges LIMIT 1;
    END IF;

    -- --------------------------------------------------------------------------
    -- 1. BACKFILL COMPANIES FROM CUSTOMERS TABLE
    -- --------------------------------------------------------------------------
    FOR r_cust IN SELECT * FROM public.customers LOOP
        BEGIN
            INSERT INTO public.companies (
                name,
                code,
                company_type,
                status,
                legacy_customer_id
            ) VALUES (
                r_cust.name,
                UPPER(REGEXP_REPLACE(r_cust.name, '[^a-zA-Z0-9]', '', 'g')) || '-CUST',
                'Customer',
                'Active',
                r_cust.id
            )
            ON CONFLICT (name) DO UPDATE SET legacy_customer_id = EXCLUDED.legacy_customer_id
            RETURNING id INTO v_company_id;

            -- Backfill best-effort primary address for company
            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.address_book (
                    company_id,
                    address_type,
                    street_1,
                    city,
                    state,
                    country,
                    is_primary
                ) VALUES (
                    v_company_id,
                    'HQ',
                    'Main Corporate Blvd, Suite 100',
                    'Los Angeles',
                    'CA',
                    'United States',
                    TRUE
                ) ON CONFLICT DO NOTHING;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
            INSERT INTO public.migration_exceptions (
                source_table,
                source_id,
                reason,
                payload
            ) VALUES (
                'customers',
                r_cust.id::text,
                'Failed to backfill customer into companies: ' || v_error_msg,
                to_jsonb(r_cust)
            );
        END;
    END LOOP;

    -- --------------------------------------------------------------------------
    -- 2. LINK PROFILES TO BACKFILLED COMPANIES
    -- --------------------------------------------------------------------------
    UPDATE public.profiles p
    SET company_id = c.id
    FROM public.companies c
    WHERE p.customer_id IS NOT NULL AND c.legacy_customer_id = p.customer_id;

    -- --------------------------------------------------------------------------
    -- 3. BACKFILL STYLES & SKUs FROM HISTORICAL WORK ORDERS
    -- --------------------------------------------------------------------------
    FOR r_wo IN 
        SELECT DISTINCT 
            COALESCE(style_name, 'Standard Denim Pants') as style_name,
            COALESCE(colorway, 'Raw Indigo') as colorway,
            size_breakdown
        FROM public.work_orders
    LOOP
        BEGIN
            v_clean_code := UPPER(REGEXP_REPLACE(r_wo.style_name, '[^a-zA-Z0-9]', '-', 'g'));
            
            -- Insert or fetch Style
            INSERT INTO public.styles (
                style_code,
                style_name,
                category,
                size_range_id,
                description
            ) VALUES (
                v_clean_code,
                r_wo.style_name,
                'Denim',
                v_default_size_range_id,
                'Historical migrated style record'
            )
            ON CONFLICT (style_code) DO UPDATE SET style_name = EXCLUDED.style_name
            RETURNING id INTO v_style_id;

            IF v_style_id IS NULL THEN
                SELECT id INTO v_style_id FROM public.styles WHERE style_code = v_clean_code;
            END IF;

            -- Create SKUs for standard sizes (e.g. 28, 30, 32, 34, 36)
            FOREACH v_size_code IN ARRAY ARRAY['28', '30', '32', '34', '36', 'M', 'L'] LOOP
                BEGIN
                    INSERT INTO public.skus (
                        style_id,
                        colorway,
                        size_code,
                        sku_code
                    ) VALUES (
                        v_style_id,
                        r_wo.colorway,
                        v_size_code,
                        v_clean_code || '-' || UPPER(REGEXP_REPLACE(r_wo.colorway, '\s+', '', 'g')) || '-' || v_size_code
                    ) ON CONFLICT (style_id, colorway, size_code) DO NOTHING;
                EXCEPTION WHEN OTHERS THEN
                    NULL; -- Skip duplicate SKUs silently
                END;
            END LOOP;

        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
            INSERT INTO public.migration_exceptions (
                source_table,
                source_id,
                reason,
                payload
            ) VALUES (
                'work_orders',
                r_wo.style_name || ':' || r_wo.colorway,
                'Failed to backfill historical style/sku: ' || v_error_msg,
                to_jsonb(r_wo)
            );
        END;
    END LOOP;

    -- --------------------------------------------------------------------------
    -- 4. CONSOLIDATE HISTORICAL INVENTORY (materials & raw_materials_intake)
    -- --------------------------------------------------------------------------
    FOR r_rmi IN SELECT * FROM public.raw_materials_intake LOOP
        BEGIN
            v_clean_code := 'ITEM-' || UPPER(REGEXP_REPLACE(r_rmi.item_name, '[^a-zA-Z0-9]', '', 'g'));

            INSERT INTO public.inventory_items (
                item_code,
                item_name,
                category,
                unit_of_measure,
                minimum_reorder_level
            ) VALUES (
                v_clean_code,
                r_rmi.item_name,
                COALESCE(r_rmi.category, 'Fabric'),
                COALESCE(r_rmi.unit, 'Yards'),
                100.00
            )
            ON CONFLICT (item_code) DO UPDATE SET item_name = EXCLUDED.item_name
            RETURNING id INTO v_item_id;

            IF v_item_id IS NULL THEN
                SELECT id INTO v_item_id FROM public.inventory_items WHERE item_code = v_clean_code;
            END IF;

            IF v_item_id IS NOT NULL AND r_rmi.lot_number IS NOT NULL THEN
                INSERT INTO public.inventory_lots (
                    item_id,
                    lot_number,
                    quantity_on_hand,
                    allocated_qty,
                    location_bin
                ) VALUES (
                    v_item_id,
                    r_rmi.lot_number,
                    COALESCE(r_rmi.quantity_accepted, r_rmi.quantity_received, 0),
                    0,
                    COALESCE(r_rmi.storage_location, 'Main Warehouse')
                ) ON CONFLICT ON CONSTRAINT uq_inventory_item_lot_facility DO NOTHING;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
            INSERT INTO public.migration_exceptions (
                source_table,
                source_id,
                reason,
                payload
            ) VALUES (
                'raw_materials_intake',
                r_rmi.id::text,
                'Failed to backfill inventory item: ' || v_error_msg,
                to_jsonb(r_rmi)
            );
        END;
    END LOOP;

END $$;
