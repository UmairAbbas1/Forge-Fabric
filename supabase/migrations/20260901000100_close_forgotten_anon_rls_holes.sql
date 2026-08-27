-- ============================================================================
-- CLOSE FORGOTTEN WIDE-OPEN RLS POLICIES
--
-- Several early migrations created `FOR ALL ... TO authenticated, anon
-- USING (true) WITH CHECK (true)` (or equivalent) policies as a temporary
-- unblock, then later migrations added properly scoped policies alongside
-- them without ever dropping the original by name. Since Postgres OR's
-- multiple permissive policies together, the forgotten open policy silently
-- overrides every scoped policy layered on top of it — the table has
-- effectively had no real access control this whole time.
--
-- This was caught during an RLS-vs-frontend-permissions audit (see
-- src/lib/permissions.ts) requested against the invite flow. Confirmed via
-- migration history that none of the policies dropped below were ever
-- superseded by a later DROP POLICY of the same name — they are live today.
--
-- Two tables (sewing_tickets, and — going further than the tables already
-- known to be exposed — customers, materials, cutting_records,
-- sewing_bundles, wash_batches, cartons, notifications) turned out to have
-- *no other policy at all*, so simply dropping the open one would lock out
-- every legitimate user too. Those get a baseline internal-staff-only
-- replacement policy, matching the exact convention already used for
-- sku_mappings/qc_inspections/qc_records in 20260823000000_v2_spec_production_upgrade.sql.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ------------------------------------------------------------------------------
-- cut_tickets — proper is_internal_staff()-scoped policies already exist
-- (cut_tickets_staff_all, cut_tickets_production_all); just remove the
-- anon/public backdoor layered on top of them.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cut_tickets_full_access" ON public.cut_tickets;

-- ------------------------------------------------------------------------------
-- orders — proper staff + customer-scoped policies already exist
-- ("Allow customer select their own orders", orders_staff_write/update/delete,
-- all added in 20260823000000_v2_spec_production_upgrade.sql). These four
-- older policies from 20260808000100_fix_all_rls_recursion_and_pipeline.sql
-- were never dropped and are the worst hole found: is_authorized_order()
-- returns TRUE for any unauthenticated caller, and insert/update were open
-- to anon outright.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_update_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_authorized" ON public.orders;

-- ------------------------------------------------------------------------------
-- sewing_tickets — had ONLY the open policy; replace with the same
-- is_internal_staff() baseline cut_tickets already uses.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sewing_tickets_full_access" ON public.sewing_tickets;
DROP POLICY IF EXISTS "sewing_tickets_staff_all" ON public.sewing_tickets;
CREATE POLICY "sewing_tickets_staff_all" ON public.sewing_tickets
  FOR ALL TO authenticated USING (public.is_internal_staff());

-- ------------------------------------------------------------------------------
-- customers — legacy CRM table, still read/written by src/hooks/useAuth.tsx
-- and src/hooks/useAppData.tsx. Had ONLY the open policy.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_all" ON public.customers;
DROP POLICY IF EXISTS "customers_update_all" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_all" ON public.customers;
DROP POLICY IF EXISTS "customers_staff_all" ON public.customers;
CREATE POLICY "customers_staff_all" ON public.customers
  FOR ALL TO authenticated USING (public.is_internal_staff());

-- ------------------------------------------------------------------------------
-- materials, cutting_records, sewing_bundles, wash_batches, cartons,
-- notifications — all still actively read/written by src/hooks/useAppData.tsx
-- and shop-floor components. Each had ONLY the open policy.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "materials_all" ON public.materials;
DROP POLICY IF EXISTS "materials_staff_all" ON public.materials;
CREATE POLICY "materials_staff_all" ON public.materials
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "cutting_records_all" ON public.cutting_records;
DROP POLICY IF EXISTS "cutting_records_staff_all" ON public.cutting_records;
CREATE POLICY "cutting_records_staff_all" ON public.cutting_records
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "sewing_bundles_all" ON public.sewing_bundles;
DROP POLICY IF EXISTS "sewing_bundles_staff_all" ON public.sewing_bundles;
CREATE POLICY "sewing_bundles_staff_all" ON public.sewing_bundles
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "wash_batches_all" ON public.wash_batches;
DROP POLICY IF EXISTS "wash_batches_staff_all" ON public.wash_batches;
CREATE POLICY "wash_batches_staff_all" ON public.wash_batches
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "cartons_all" ON public.cartons;
DROP POLICY IF EXISTS "cartons_staff_all" ON public.cartons;
CREATE POLICY "cartons_staff_all" ON public.cartons
  FOR ALL TO authenticated USING (public.is_internal_staff());

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_staff_all" ON public.notifications;
CREATE POLICY "notifications_staff_all" ON public.notifications
  FOR ALL TO authenticated USING (public.is_internal_staff());
