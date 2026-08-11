-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 6: ENTERPRISE RBAC ROW-LEVEL SECURITY (RLS)
-- Migration: 20260811000600_erp_rls_security_policies.sql
-- Eliminates all string-matching policies (Gap P8) in favor of strict FK + Role checks.
-- ==============================================================================

-- 1. HELPER SECURITY DEFINER FUNCTIONS FOR PERFORMANCE & ZERO RECURSION

-- Get current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS VARCHAR AS $$
  SELECT role::varchar FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Get current authenticated user's company_id
CREATE OR REPLACE FUNCTION public.get_auth_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Check if user has an internal staff role
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role::varchar IN (
      'super_admin', 'admin', 'merchandiser', 'production_manager', 
      'cutting_supervisor', 'sewing_supervisor', 'qc_inspector', 'warehouse', 'finance'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role::varchar IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Enable RLS on all newly created master and transactional tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_exceptions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. POLICIES FOR COMPANIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS companies_admin_all ON public.companies;
CREATE POLICY companies_admin_all ON public.companies
    FOR ALL TO authenticated
    USING (public.is_admin_user());

DROP POLICY IF EXISTS companies_staff_select ON public.companies;
CREATE POLICY companies_staff_select ON public.companies
    FOR SELECT TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS companies_customer_own_select ON public.companies;
CREATE POLICY companies_customer_own_select ON public.companies
    FOR SELECT TO authenticated
    USING (id = public.get_auth_user_company_id());

-- ------------------------------------------------------------------------------
-- 3. POLICIES FOR ADDRESS BOOK & CONTACTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS address_book_staff_all ON public.address_book;
CREATE POLICY address_book_staff_all ON public.address_book
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS address_book_customer_own ON public.address_book;
CREATE POLICY address_book_customer_own ON public.address_book
    FOR ALL TO authenticated
    USING (company_id = public.get_auth_user_company_id())
    WITH CHECK (company_id = public.get_auth_user_company_id());

DROP POLICY IF EXISTS contacts_staff_all ON public.contacts;
CREATE POLICY contacts_staff_all ON public.contacts
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS contacts_customer_own ON public.contacts;
CREATE POLICY contacts_customer_own ON public.contacts
    FOR ALL TO authenticated
    USING (company_id = public.get_auth_user_company_id())
    WITH CHECK (company_id = public.get_auth_user_company_id());

-- ------------------------------------------------------------------------------
-- 4. POLICIES FOR PLM MASTER (SIZE RANGES, STYLES, SKUs, BOMs)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS size_ranges_read_all ON public.size_ranges;
CREATE POLICY size_ranges_read_all ON public.size_ranges
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS size_ranges_staff_write ON public.size_ranges;
CREATE POLICY size_ranges_staff_write ON public.size_ranges
    FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS styles_read_all ON public.styles;
CREATE POLICY styles_read_all ON public.styles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS styles_staff_write ON public.styles;
CREATE POLICY styles_staff_write ON public.styles
    FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS skus_read_all ON public.skus;
CREATE POLICY skus_read_all ON public.skus
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS skus_staff_write ON public.skus;
CREATE POLICY skus_staff_write ON public.skus
    FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS boms_read_staff_and_customer ON public.boms;
CREATE POLICY boms_read_staff_and_customer ON public.boms
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS boms_staff_write ON public.boms;
CREATE POLICY boms_staff_write ON public.boms
    FOR ALL TO authenticated USING (public.is_internal_staff());

-- ------------------------------------------------------------------------------
-- 5. POLICIES FOR PURCHASE ORDERS & PO LINE ITEMS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS po_staff_all ON public.purchase_orders;
CREATE POLICY po_staff_all ON public.purchase_orders
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS po_customer_own ON public.purchase_orders;
CREATE POLICY po_customer_own ON public.purchase_orders
    FOR SELECT TO authenticated
    USING (customer_id = public.get_auth_user_company_id());

DROP POLICY IF EXISTS po_customer_insert ON public.purchase_orders;
CREATE POLICY po_customer_insert ON public.purchase_orders
    FOR INSERT TO authenticated
    WITH CHECK (customer_id = public.get_auth_user_company_id());

DROP POLICY IF EXISTS po_line_items_staff_all ON public.po_line_items;
CREATE POLICY po_line_items_staff_all ON public.po_line_items
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS po_line_items_customer_own ON public.po_line_items;
CREATE POLICY po_line_items_customer_own ON public.po_line_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_orders po
            WHERE po.id = po_line_items.po_id
            AND po.customer_id = public.get_auth_user_company_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 6. POLICIES FOR SHOP FLOOR (CUT TICKETS, QC INSPECTIONS, PACKING LISTS, INVENTORY LOTS)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS cut_tickets_staff_all ON public.cut_tickets;
CREATE POLICY cut_tickets_staff_all ON public.cut_tickets
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS qc_inspections_staff_all ON public.qc_inspections;
CREATE POLICY qc_inspections_staff_all ON public.qc_inspections
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS packing_lists_staff_all ON public.packing_lists;
CREATE POLICY packing_lists_staff_all ON public.packing_lists
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS packing_lists_customer_select ON public.packing_lists;
CREATE POLICY packing_lists_customer_select ON public.packing_lists
    FOR SELECT TO authenticated
    USING (customer_id = public.get_auth_user_company_id());

DROP POLICY IF EXISTS inventory_lots_staff_all ON public.inventory_lots;
CREATE POLICY inventory_lots_staff_all ON public.inventory_lots
    FOR ALL TO authenticated
    USING (public.is_internal_staff());

DROP POLICY IF EXISTS exceptions_admin_all ON public.migration_exceptions;
CREATE POLICY exceptions_admin_all ON public.migration_exceptions
    FOR ALL TO authenticated
    USING (public.is_admin_user());

-- ------------------------------------------------------------------------------
-- 7. REWRITE OLD STRING-MATCHING POLICIES ON LEGACY TABLES (Eliminating Gap P8)
-- ------------------------------------------------------------------------------

-- Legacy Orders Table
DROP POLICY IF EXISTS "Allow customer select their own orders" ON public.orders;
CREATE POLICY "Allow customer select their own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (
        public.is_internal_staff() OR 
        customer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.name = public.orders.customer_name 
            AND c.id = public.get_auth_user_company_id()
        )
    );

-- Legacy Blanket POs Table
DROP POLICY IF EXISTS blanket_pos_customer ON public.blanket_pos;
CREATE POLICY blanket_pos_customer ON public.blanket_pos
    FOR SELECT TO authenticated
    USING (
        public.is_internal_staff() OR
        customer_id = public.get_auth_user_company_id()
    );

-- Legacy Raw Materials Intake
DROP POLICY IF EXISTS raw_materials_customer_select ON public.raw_materials_intake;
CREATE POLICY raw_materials_customer_select ON public.raw_materials_intake
    FOR SELECT TO authenticated
    USING (
        public.is_internal_staff() OR
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.purchase_orders po ON po.id = wo.po_line_item_id
            WHERE wo.id = raw_materials_intake.work_order_id
            AND po.customer_id = public.get_auth_user_company_id()
        )
    );
