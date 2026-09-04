-- ============================================================================
-- Closes two remaining anon-access RLS holes found in a security review
-- (the wider cleanup in 20260901001200/001300 missed these two).
--
-- 1. inventory_issuances: still carried "inventory_issuances_full_access"
--    (FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true)),
--    added by 20260818000000_update_cut_tickets_schema.sql and never
--    dropped. Any unauthenticated visitor could read or write every raw
--    material consumption record for every order/brand. Only cutting.tsx
--    (writes) and shop-floor.tsx / useOrderMaterialBalance.ts (reads) touch
--    this table — all internal-staff-only pages — so restricting to staff
--    disturbs nothing working today. A narrower pre-existing policy
--    ("Internal Staff can manage Issuances") already covers a subset of
--    staff roles and is left in place untouched; this just adds the same
--    is_internal_staff() convention used everywhere else and removes the
--    open one.
--
-- 2. address_book: address_book_public_select / address_book_public_insert
--    (20260823000000_v2_spec_production_upgrade.sql) grant blanket
--    read/insert to BOTH anon and authenticated, exposing every company's
--    full address book (all address types) to any logged-in user, not just
--    their own company. 20260825010000_dispatch_customer_scoped_rls.sql
--    already added the correct scoped policies for authenticated users
--    (address_book_staff_all / address_book_customer_read / _write /
--    _update) — they just never had this wider "authenticated" grant
--    removed, so it kept overriding them. Narrowing these two policies to
--    anon-only keeps the public /apply intake wizard (AddressSelector.tsx,
--    always filtered by company_id) fully working, while logged-in
--    customers/staff now go through the already-correct scoped policies.
--
-- Idempotent throughout.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- inventory_issuances
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "inventory_issuances_full_access" ON public.inventory_issuances;

DROP POLICY IF EXISTS "inventory_issuances_staff_all" ON public.inventory_issuances;
CREATE POLICY "inventory_issuances_staff_all" ON public.inventory_issuances
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

-- ---------------------------------------------------------------------------
-- address_book — narrow the public-intake policies to anon only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "address_book_public_select" ON public.address_book;
CREATE POLICY "address_book_public_select" ON public.address_book
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "address_book_public_insert" ON public.address_book;
CREATE POLICY "address_book_public_insert" ON public.address_book
  FOR INSERT TO anon WITH CHECK (true);
