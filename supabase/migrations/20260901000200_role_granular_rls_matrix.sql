-- ============================================================================
-- ROLE-GRANULAR RLS — mirrors src/lib/permissions.ts PERMISSION_MATRIX
--
-- Until now, most operational tables gated access with is_internal_staff(),
-- a single bucket covering every non-customer role equally. That meant, for
-- example, a qc_inspector or warehouse account could fully read/write
-- purchase_orders and inventory_lots even though permissions.ts explicitly
-- denies them that access on the frontend — RLS was not actually enforcing
-- what the UI claimed. This was flagged in an RLS-vs-frontend audit and
-- confirmed with the project owner to be tightened, not left as-is.
--
-- has_module_permission(module, action) is a direct SQL transcription of
-- PERMISSION_MATRIX — the two must be kept in sync by hand if the frontend
-- matrix changes. Only tables actually audited and mapped to a specific
-- frontend module are touched here: companies (crm), orders + purchase_orders
-- (orders), qc_inspections + qc_records (qc), inventory_lots (inventory),
-- cut_tickets + sewing_tickets + cutting_records + sewing_bundles (shop_floor).
-- Tables not covered by this pass (po_line_items, styles/skus, shipments,
-- packing_lists, delivery_manifests, invoices, etc.) still use their
-- existing is_internal_staff()-broad or table-specific policies — a further
-- pass would be needed to cover those too.
--
-- Existing customer-scoping, admin-only, and public-intake policies are left
-- untouched; only the internal-staff-broad policies on the tables above are
-- replaced.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_module_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role::varchar INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND coalesce(deactivated, false) = false;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN CASE p_module
    WHEN 'crm' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'warehouse' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'product_master' THEN CASE v_role
      WHEN 'merchandiser' THEN TRUE
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'orders' THEN CASE v_role
      WHEN 'merchandiser' THEN TRUE
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'production_planning' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN TRUE
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'production' THEN TRUE
      ELSE FALSE
    END
    WHEN 'shop_floor' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN TRUE
      WHEN 'cutting_supervisor' THEN p_action IN ('create', 'read', 'update')
      WHEN 'sewing_supervisor' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'qc' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'qc_inspector' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production' THEN p_action = 'read'
      WHEN 'qc' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'inventory' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production_manager' THEN p_action IN ('create', 'read', 'update')
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'warehouse' THEN TRUE
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'shipping' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'warehouse' THEN TRUE
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'finance' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'finance' THEN TRUE
      ELSE FALSE
    END
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- ------------------------------------------------------------------------------
-- COMPANIES (crm) — companies_admin_all, companies_customer_own_select,
-- companies_public_intake_select/insert, companies_staff_delete (admin-only,
-- already correct) are untouched.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_staff_select" ON public.companies;
CREATE POLICY "companies_staff_select" ON public.companies
  FOR SELECT TO authenticated
  USING (public.has_module_permission('crm', 'read'));

DROP POLICY IF EXISTS "companies_staff_update" ON public.companies;
CREATE POLICY "companies_staff_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_module_permission('crm', 'update'));

-- ------------------------------------------------------------------------------
-- ORDERS (orders) — customer-scoped SELECT policy keeps its customer clause;
-- only the is_internal_staff() bucket is tightened. orders_staff_delete
-- widens from admin-only to admin+merchandiser to match permissions.ts,
-- which explicitly grants merchandiser delete:true on the orders module.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow customer select their own orders" ON public.orders;
CREATE POLICY "Allow customer select their own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.has_module_permission('orders', 'read') OR
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.name = public.orders.customer_name
      AND c.id = public.get_auth_user_company_id()
    )
  );

DROP POLICY IF EXISTS "orders_staff_write" ON public.orders;
CREATE POLICY "orders_staff_write" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('orders', 'create'));

DROP POLICY IF EXISTS "orders_staff_update" ON public.orders;
CREATE POLICY "orders_staff_update" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_module_permission('orders', 'update'));

DROP POLICY IF EXISTS "orders_staff_delete" ON public.orders;
CREATE POLICY "orders_staff_delete" ON public.orders
  FOR DELETE TO authenticated USING (public.has_module_permission('orders', 'delete'));

-- ------------------------------------------------------------------------------
-- PURCHASE_ORDERS (orders module — same customer PO/order-lifecycle domain).
-- po_customer_own / po_customer_insert (customer-scoped) are untouched.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "po_staff_all" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_staff_select" ON public.purchase_orders;
CREATE POLICY "po_staff_select" ON public.purchase_orders
  FOR SELECT TO authenticated USING (public.has_module_permission('orders', 'read'));

DROP POLICY IF EXISTS "po_staff_insert" ON public.purchase_orders;
CREATE POLICY "po_staff_insert" ON public.purchase_orders
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('orders', 'create'));

DROP POLICY IF EXISTS "po_staff_update" ON public.purchase_orders;
CREATE POLICY "po_staff_update" ON public.purchase_orders
  FOR UPDATE TO authenticated USING (public.has_module_permission('orders', 'update'));

DROP POLICY IF EXISTS "po_staff_delete" ON public.purchase_orders;
CREATE POLICY "po_staff_delete" ON public.purchase_orders
  FOR DELETE TO authenticated USING (public.has_module_permission('orders', 'delete'));

-- ------------------------------------------------------------------------------
-- QC_INSPECTIONS / QC_RECORDS (qc) — no role has delete:true in this module
-- except admin/super_admin, so no non-admin DELETE policy is created.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "qc_inspections_staff_scoped" ON public.qc_inspections;
DROP POLICY IF EXISTS "qc_inspections_staff_select" ON public.qc_inspections;
CREATE POLICY "qc_inspections_staff_select" ON public.qc_inspections
  FOR SELECT TO authenticated USING (public.has_module_permission('qc', 'read'));

DROP POLICY IF EXISTS "qc_inspections_staff_insert" ON public.qc_inspections;
CREATE POLICY "qc_inspections_staff_insert" ON public.qc_inspections
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('qc', 'create'));

DROP POLICY IF EXISTS "qc_inspections_staff_update" ON public.qc_inspections;
CREATE POLICY "qc_inspections_staff_update" ON public.qc_inspections
  FOR UPDATE TO authenticated USING (public.has_module_permission('qc', 'update'));

DROP POLICY IF EXISTS "qc_records_staff_scoped" ON public.qc_records;
DROP POLICY IF EXISTS "qc_records_staff_select" ON public.qc_records;
CREATE POLICY "qc_records_staff_select" ON public.qc_records
  FOR SELECT TO authenticated USING (public.has_module_permission('qc', 'read'));

DROP POLICY IF EXISTS "qc_records_staff_insert" ON public.qc_records;
CREATE POLICY "qc_records_staff_insert" ON public.qc_records
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('qc', 'create'));

DROP POLICY IF EXISTS "qc_records_staff_update" ON public.qc_records;
CREATE POLICY "qc_records_staff_update" ON public.qc_records
  FOR UPDATE TO authenticated USING (public.has_module_permission('qc', 'update'));

-- ------------------------------------------------------------------------------
-- INVENTORY_LOTS (inventory) — delete:true only for warehouse/admin.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "inventory_lots_staff_all" ON public.inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_staff_select" ON public.inventory_lots;
CREATE POLICY "inventory_lots_staff_select" ON public.inventory_lots
  FOR SELECT TO authenticated USING (public.has_module_permission('inventory', 'read'));

DROP POLICY IF EXISTS "inventory_lots_staff_insert" ON public.inventory_lots;
CREATE POLICY "inventory_lots_staff_insert" ON public.inventory_lots
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('inventory', 'create'));

DROP POLICY IF EXISTS "inventory_lots_staff_update" ON public.inventory_lots;
CREATE POLICY "inventory_lots_staff_update" ON public.inventory_lots
  FOR UPDATE TO authenticated USING (public.has_module_permission('inventory', 'update'));

DROP POLICY IF EXISTS "inventory_lots_staff_delete" ON public.inventory_lots;
CREATE POLICY "inventory_lots_staff_delete" ON public.inventory_lots
  FOR DELETE TO authenticated USING (public.has_module_permission('inventory', 'delete'));

-- ------------------------------------------------------------------------------
-- CUT_TICKETS / SEWING_TICKETS / CUTTING_RECORDS / SEWING_BUNDLES
-- (shop_floor) — delete:true only for production_manager/admin.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cut_tickets_staff_all" ON public.cut_tickets;
DROP POLICY IF EXISTS "cut_tickets_production_all" ON public.cut_tickets;
DROP POLICY IF EXISTS "cut_tickets_staff_select" ON public.cut_tickets;
CREATE POLICY "cut_tickets_staff_select" ON public.cut_tickets
  FOR SELECT TO authenticated USING (public.has_module_permission('shop_floor', 'read'));
DROP POLICY IF EXISTS "cut_tickets_staff_insert" ON public.cut_tickets;
CREATE POLICY "cut_tickets_staff_insert" ON public.cut_tickets
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('shop_floor', 'create'));
DROP POLICY IF EXISTS "cut_tickets_staff_update" ON public.cut_tickets;
CREATE POLICY "cut_tickets_staff_update" ON public.cut_tickets
  FOR UPDATE TO authenticated USING (public.has_module_permission('shop_floor', 'update'));
DROP POLICY IF EXISTS "cut_tickets_staff_delete" ON public.cut_tickets;
CREATE POLICY "cut_tickets_staff_delete" ON public.cut_tickets
  FOR DELETE TO authenticated USING (public.has_module_permission('shop_floor', 'delete'));

DROP POLICY IF EXISTS "sewing_tickets_staff_all" ON public.sewing_tickets;
DROP POLICY IF EXISTS "sewing_tickets_staff_select" ON public.sewing_tickets;
CREATE POLICY "sewing_tickets_staff_select" ON public.sewing_tickets
  FOR SELECT TO authenticated USING (public.has_module_permission('shop_floor', 'read'));
DROP POLICY IF EXISTS "sewing_tickets_staff_insert" ON public.sewing_tickets;
CREATE POLICY "sewing_tickets_staff_insert" ON public.sewing_tickets
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('shop_floor', 'create'));
DROP POLICY IF EXISTS "sewing_tickets_staff_update" ON public.sewing_tickets;
CREATE POLICY "sewing_tickets_staff_update" ON public.sewing_tickets
  FOR UPDATE TO authenticated USING (public.has_module_permission('shop_floor', 'update'));
DROP POLICY IF EXISTS "sewing_tickets_staff_delete" ON public.sewing_tickets;
CREATE POLICY "sewing_tickets_staff_delete" ON public.sewing_tickets
  FOR DELETE TO authenticated USING (public.has_module_permission('shop_floor', 'delete'));

DROP POLICY IF EXISTS "cutting_records_staff_all" ON public.cutting_records;
DROP POLICY IF EXISTS "cutting_records_staff_select" ON public.cutting_records;
CREATE POLICY "cutting_records_staff_select" ON public.cutting_records
  FOR SELECT TO authenticated USING (public.has_module_permission('shop_floor', 'read'));
DROP POLICY IF EXISTS "cutting_records_staff_insert" ON public.cutting_records;
CREATE POLICY "cutting_records_staff_insert" ON public.cutting_records
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('shop_floor', 'create'));
DROP POLICY IF EXISTS "cutting_records_staff_update" ON public.cutting_records;
CREATE POLICY "cutting_records_staff_update" ON public.cutting_records
  FOR UPDATE TO authenticated USING (public.has_module_permission('shop_floor', 'update'));
DROP POLICY IF EXISTS "cutting_records_staff_delete" ON public.cutting_records;
CREATE POLICY "cutting_records_staff_delete" ON public.cutting_records
  FOR DELETE TO authenticated USING (public.has_module_permission('shop_floor', 'delete'));

DROP POLICY IF EXISTS "sewing_bundles_staff_all" ON public.sewing_bundles;
DROP POLICY IF EXISTS "sewing_bundles_staff_select" ON public.sewing_bundles;
CREATE POLICY "sewing_bundles_staff_select" ON public.sewing_bundles
  FOR SELECT TO authenticated USING (public.has_module_permission('shop_floor', 'read'));
DROP POLICY IF EXISTS "sewing_bundles_staff_insert" ON public.sewing_bundles;
CREATE POLICY "sewing_bundles_staff_insert" ON public.sewing_bundles
  FOR INSERT TO authenticated WITH CHECK (public.has_module_permission('shop_floor', 'create'));
DROP POLICY IF EXISTS "sewing_bundles_staff_update" ON public.sewing_bundles;
CREATE POLICY "sewing_bundles_staff_update" ON public.sewing_bundles
  FOR UPDATE TO authenticated USING (public.has_module_permission('shop_floor', 'update'));
DROP POLICY IF EXISTS "sewing_bundles_staff_delete" ON public.sewing_bundles;
CREATE POLICY "sewing_bundles_staff_delete" ON public.sewing_bundles
  FOR DELETE TO authenticated USING (public.has_module_permission('shop_floor', 'delete'));
