-- ==============================================================================
-- FIX #3 (client-presentation batch): Dispatch tab cross-brand data leak.
--
-- public.packing_lists and public.address_book were left with wide-open
-- policies from 20260819000000_fix_packing_lists_and_address_book.sql
-- ("FOR ALL TO public, anon, authenticated USING (true)") — any logged-in
-- customer could read every other brand's packing lists and shipping
-- addresses via src/routes/dispatch.tsx. This replaces those with the same
-- customer_name -> companies.name -> get_auth_user_company_id() scoping
-- pattern already used for order-documents storage RLS
-- (20260824000000_order_batch_splitting_and_documents.sql), since neither
-- table has a populated company_id FK on its existing rows to join on
-- directly.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- packing_lists: staff keep full access; a customer sees only rows whose
-- customer_name matches their own company's name.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.packing_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packing_lists_full_access" ON public.packing_lists;
DROP POLICY IF EXISTS "packing_lists_staff_all" ON public.packing_lists;
DROP POLICY IF EXISTS "packing_lists_production" ON public.packing_lists;
DROP POLICY IF EXISTS "packing_lists_customer_read" ON public.packing_lists;

CREATE POLICY "packing_lists_staff_all" ON public.packing_lists
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

CREATE POLICY "packing_lists_customer_read" ON public.packing_lists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.name = public.packing_lists.customer_name
      AND c.id = public.get_auth_user_company_id()
    )
  );

-- ------------------------------------------------------------------------------
-- address_book: staff keep full access; a customer sees only their own
-- company_id rows, or (for the legacy seed rows that predate the company_id
-- column being populated) rows whose customer_name matches their company.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.address_book ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "address_book_full_access" ON public.address_book;
DROP POLICY IF EXISTS "address_book_staff_all" ON public.address_book;
DROP POLICY IF EXISTS "address_book_customer_read" ON public.address_book;

CREATE POLICY "address_book_staff_all" ON public.address_book
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

CREATE POLICY "address_book_customer_read" ON public.address_book
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_auth_user_company_id()
    OR (
      company_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.name = public.address_book.customer_name
        AND c.id = public.get_auth_user_company_id()
      )
    )
  );

-- A customer may also create/edit their own saved addresses (REQ: editable
-- address_book entries in the intake wizard, AddressSelector.tsx).
DROP POLICY IF EXISTS "address_book_customer_write" ON public.address_book;
CREATE POLICY "address_book_customer_write" ON public.address_book
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_auth_user_company_id());

DROP POLICY IF EXISTS "address_book_customer_update" ON public.address_book;
CREATE POLICY "address_book_customer_update" ON public.address_book
  FOR UPDATE TO authenticated
  USING (company_id = public.get_auth_user_company_id())
  WITH CHECK (company_id = public.get_auth_user_company_id());
