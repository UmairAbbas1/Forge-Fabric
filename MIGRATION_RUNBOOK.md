# Forge & Fabric: Enterprise Database Migration Runbook

This document details the exact execution order, post-migration verification queries, row count checks, FK integrity validations, and rollback strategies for the 7 new database migrations supporting the generic apparel ERP architecture.

---

## 1. Migration Execution Sequence

Run the migrations in strict numerical order to preserve foreign key dependencies.

```
[1. Core Master Entities] ──> [2. Sales & Profiles] ──> [3. Shop Floor & QC]
                                                              │
[7. Atomic PO Conversion] <── [6. RBAC RLS Policies] <── [5. Data Backfill] <── [4. Inventory Lots]
```

---

## 2. Granular Step-by-Step Runbook

### Step 1: `20260811000100_erp_core_master_entities.sql`
*   **Purpose:** Creates `migration_exceptions`, `companies`, `address_book`, `contacts`, `size_ranges` (seeded), `styles`, `skus` (with auto-code generator trigger), and `boms`.
*   **Verification Query:**
    ```sql
    SELECT name, jsonb_array_length(sizes) as num_sizes FROM public.size_ranges;
    -- Expected: 3 rows ('Adult Denim Numeric' [10], 'Alpha Apparel Standard' [7], 'Kids Toddler Age' [7])
    
    SELECT count(*) FROM public.companies;
    -- Verification of tables creation without errors
    ```
*   **Rollback Strategy:**
    ```sql
    DROP TABLE IF EXISTS public.boms CASCADE;
    DROP TABLE IF EXISTS public.skus CASCADE;
    DROP TABLE IF EXISTS public.styles CASCADE;
    DROP TABLE IF EXISTS public.size_ranges CASCADE;
    DROP TABLE IF EXISTS public.contacts CASCADE;
    DROP TABLE IF EXISTS public.address_book CASCADE;
    DROP TABLE IF EXISTS public.companies CASCADE;
    DROP TABLE IF EXISTS public.migration_exceptions CASCADE;
    ```

---

### Step 2: `20260811000200_erp_sales_planning_and_wos.sql`
*   **Purpose:** Creates `purchase_orders` and `po_line_items`. Alters `profiles` table to add `company_id`, `facility_scope`, `status`, and role values (`super_admin`, `finance`, etc.). Alters `work_orders` to add `po_line_item_id` and `facility_id` while annotating deprecation on legacy text fields.
*   **Verification Query:**
    ```sql
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name IN ('company_id', 'facility_scope', 'status');
    -- Expected: 3 columns returned
    ```
*   **Rollback Strategy:**
    ```sql
    ALTER TABLE public.work_orders DROP COLUMN IF EXISTS po_line_item_id, DROP COLUMN IF EXISTS facility_id;
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_id, DROP COLUMN IF EXISTS facility_scope, DROP COLUMN IF EXISTS status;
    DROP TABLE IF EXISTS public.po_line_items CASCADE;
    DROP TABLE IF EXISTS public.purchase_orders CASCADE;
    ```

---

### Step 3: `20260811000300_erp_mes_shop_floor_and_qc.sql`
*   **Purpose:** Creates `cut_tickets`, `qc_inspections` (consolidated QC audit log), and `packing_lists`. Alters `bundles` to add `cut_ticket_id` and `sku_id`. Alters `cartons` to add `packing_list_id` and `sku_id`.
*   **Verification Query:**
    ```sql
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'bundles' AND column_name IN ('cut_ticket_id', 'sku_id');
    -- Expected: 2 columns returned
    ```
*   **Rollback Strategy:**
    ```sql
    ALTER TABLE public.cartons DROP COLUMN IF EXISTS packing_list_id, DROP COLUMN IF EXISTS sku_id;
    DROP TABLE IF EXISTS public.packing_lists CASCADE;
    DROP TABLE IF EXISTS public.qc_inspections CASCADE;
    ALTER TABLE public.bundles DROP COLUMN IF EXISTS cut_ticket_id, DROP COLUMN IF EXISTS sku_id;
    DROP TABLE IF EXISTS public.cut_tickets CASCADE;
    ```

---

### Step 4: `20260811000400_erp_inventory_and_lots.sql`
*   **Purpose:** Extends `inventory_items` master table and creates `inventory_lots` for transactional bin/batch tracking with generated `available_qty`.
*   **Verification Query:**
    ```sql
    SELECT table_name, column_name, generation_expression 
    FROM information_schema.columns 
    WHERE table_name = 'inventory_lots' AND column_name = 'available_qty';
    -- Expected: GENERATED ALWAYS AS (quantity_on_hand - allocated_qty)
    ```
*   **Rollback Strategy:**
    ```sql
    DROP TABLE IF EXISTS public.inventory_lots CASCADE;
    ALTER TABLE public.inventory_items DROP COLUMN IF EXISTS company_id, DROP COLUMN IF EXISTS minimum_reorder_level;
    ```

---

### Step 5: `20260811000500_erp_data_migration_backfill.sql`
*   **Purpose:** Non-destructive SQL migration script backfilling `companies` from existing `customers`, linking `profiles`, deriving `styles` and `skus` from legacy `work_orders`, consolidating raw materials, and logging non-mappable rows into `migration_exceptions`.
*   **Verification Query:**
    ```sql
    -- Check backfill counts
    SELECT 'companies' as entity, count(*) FROM public.companies
    UNION ALL
    SELECT 'styles', count(*) FROM public.styles
    UNION ALL
    SELECT 'skus', count(*) FROM public.skus
    UNION ALL
    SELECT 'exceptions', count(*) FROM public.migration_exceptions;

    -- FK Integrity Check: Verify all companies link back to customers
    SELECT c.name FROM public.companies c
    LEFT JOIN public.customers cust ON cust.id = c.legacy_customer_id
    WHERE c.legacy_customer_id IS NOT NULL AND cust.id IS NULL;
    -- Expected: 0 rows (No orphaned legacy references)
    ```
*   **Rollback Strategy:**
    ```sql
    TRUNCATE public.migration_exceptions;
    -- Delete only migrated rows preserving fresh entries if required
    DELETE FROM public.companies WHERE legacy_customer_id IS NOT NULL;
    ```

---

### Step 6: `20260811000600_erp_rls_security_policies.sql`
*   **Purpose:** Applies comprehensive Row-Level Security (RLS) policies across all new and legacy tables. Replaces string-matching policies (`customer_name = name`) with helper functions (`is_internal_staff()`, `get_auth_user_company_id()`).
*   **Verification Query:**
    ```sql
    -- Check RLS status across all schema tables
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename IN ('companies', 'purchase_orders', 'work_orders', 'styles', 'skus');
    -- Expected: rowsecurity = true for all
    ```
*   **Rollback Strategy:**
    ```sql
    ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.po_line_items DISABLE ROW LEVEL SECURITY;
    -- Re-apply original legacy policies if needed
    ```

---

### Step 7: `20260811000700_erp_convert_po_function.sql`
*   **Purpose:** Deploys the atomic `convert_po_to_work_orders(p_po_id UUID)` stored procedure implementing Flow C (validating Size Ranges & BOMs, creating Work Orders, and generating Material Requisitions).
*   **Verification Query:**
    ```sql
    SELECT routine_name, data_type 
    FROM information_schema.routines 
    WHERE routine_name = 'convert_po_to_work_orders';
    -- Expected: returns jsonb
    ```
*   **Rollback Strategy:**
    ```sql
    DROP FUNCTION IF EXISTS public.convert_po_to_work_orders(UUID);
    ```

---

## 3. Post-Migration Health Check Suite

Run this consolidated SQL block to verify complete database integrity after applying all 7 migrations:

```sql
SELECT 
  (SELECT count(*) FROM public.companies) AS total_companies,
  (SELECT count(*) FROM public.styles) AS total_styles,
  (SELECT count(*) FROM public.skus) AS total_skus,
  (SELECT count(*) FROM public.size_ranges) AS size_ranges_count,
  (SELECT count(*) FROM public.migration_exceptions) AS unmapped_exceptions;
```
