-- ============================================================================
-- PRECISE FIX — supersedes 20260901001200, which guessed policy names from
-- migration-file history that turned out not to match what's actually live.
-- Every DROP below targets a policy name confirmed live via a direct
-- pg_policies query the user ran and pasted back. USING(true)/ALL policies
-- named "<table>_full_access" are the actual culprit everywhere (not the
-- differently-named ones the file history suggested).
--
-- CRITICAL finding from that same query: for several tables, the dangerous
-- "_full_access" policy is not sitting ALONGSIDE a correct one — it is the
-- ONLY policy the table has. Dropping it with nothing added back would not
-- just "close a leak", it would drop those tables to zero access for
-- everyone, including staff — and for `profiles` and `companies`
-- specifically, that would break login and session bootstrap platform-wide
-- (every other RLS policy in this database that checks a customer's own
-- company does so via a subquery against `companies`; if that table has no
-- policy letting a customer read their own row, those subqueries silently
-- return no match and the customer loses access to everything, not just
-- companies). So this migration pairs every DROP with whatever replacement
-- policy is actually needed to keep current functionality working — not
-- just a security patch, a real fix.
--
-- Idempotent throughout.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- companies — customers and the public intake wizard both need SOME read
-- access here, or every other table's "customer sees their own company's
-- rows" policy silently breaks too.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_full_access" ON public.companies;

DROP POLICY IF EXISTS "companies_customer_own_select" ON public.companies;
CREATE POLICY "companies_customer_own_select" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_auth_user_company_id() OR public.is_internal_staff());

-- Public /apply intake wizard looks up/creates companies before the visitor
-- has an account — company name/id only, not financial or order data.
DROP POLICY IF EXISTS "companies_public_intake_select" ON public.companies;
CREATE POLICY "companies_public_intake_select" ON public.companies
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "companies_public_intake_insert" ON public.companies;
CREATE POLICY "companies_public_intake_insert" ON public.companies
  FOR INSERT TO anon WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- profiles — every logged-in session reads its own profile row directly on
-- login. Without this, dropping the open policy locks out every user,
-- staff included (is_internal_staff()/get_auth_user_company_id() are
-- SECURITY DEFINER and would still work internally, but the app's own
-- direct profile read would not).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_full_access" ON public.profiles;

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_internal_staff());

DROP POLICY IF EXISTS "profiles_self_upsert" ON public.profiles;
CREATE POLICY "profiles_self_upsert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_internal_staff());

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_internal_staff());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_internal_staff());

-- ---------------------------------------------------------------------------
-- apply_submissions — was down to the open policy alone (staff_select/
-- update/delete never actually applied). Customer intake dashboards
-- (orders.tsx, CustomerPortal.tsx) read this directly by company match.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "apply_submissions_full_access" ON public.apply_submissions;

DROP POLICY IF EXISTS "apply_submissions_staff_all" ON public.apply_submissions;
CREATE POLICY "apply_submissions_staff_all" ON public.apply_submissions
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "apply_submissions_customer_select" ON public.apply_submissions;
CREATE POLICY "apply_submissions_customer_select" ON public.apply_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.apply_submissions.company_name)
    )
  );

-- Public /apply intake wizard submits without an account.
DROP POLICY IF EXISTS "apply_submissions_public_insert" ON public.apply_submissions;
CREATE POLICY "apply_submissions_public_insert" ON public.apply_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- notifications — no company/customer column, only order_id, so scoping has
-- to join through orders OR apply_submissions (the bell icon already relies
-- on a not-yet-converted submission's reference code showing up here too —
-- see the rejection-notification work earlier in this project).
-- notifications_staff_all (is_internal_staff()) already exists correctly —
-- only the customer-facing side needs adding.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_full_access" ON public.notifications;

DROP POLICY IF EXISTS "notifications_customer_select" ON public.notifications;
CREATE POLICY "notifications_customer_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE o.order_id = public.notifications.order_id
      AND lower(o.customer_name) = lower(c.name)
    )
    OR EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.apply_reference_code = public.notifications.order_id
      AND lower(s.company_name) = lower(c.name)
    )
  );

DROP POLICY IF EXISTS "notifications_customer_update" ON public.notifications;
CREATE POLICY "notifications_customer_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE o.order_id = public.notifications.order_id
      AND lower(o.customer_name) = lower(c.name)
    )
    OR EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.apply_reference_code = public.notifications.order_id
      AND lower(s.company_name) = lower(c.name)
    )
  );

-- ---------------------------------------------------------------------------
-- orders — already has a real customer SELECT policy ("Allow customer
-- select their own orders") and staff write/update/delete policies. Safe
-- to just drop the open one.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_full_access" ON public.orders;

-- ---------------------------------------------------------------------------
-- customers (legacy CRM table) — customers_staff_all already exists.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers_full_access" ON public.customers;

-- ---------------------------------------------------------------------------
-- price_quotes — was down to the open policy alone; none of the intended
-- staff/customer policies from the original design were ever applied.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "price_quotes_full_access" ON public.price_quotes;

DROP POLICY IF EXISTS "price_quotes_staff_all" ON public.price_quotes;
CREATE POLICY "price_quotes_staff_all" ON public.price_quotes
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "price_quotes_customer_select" ON public.price_quotes;
CREATE POLICY "price_quotes_customer_select" ON public.price_quotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.price_quotes.customer_name)
    )
  );

DROP POLICY IF EXISTS "price_quotes_customer_respond" ON public.price_quotes;
CREATE POLICY "price_quotes_customer_respond" ON public.price_quotes
  FOR UPDATE TO authenticated
  USING (
    status = 'Sent_To_Customer'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.price_quotes.customer_name)
    )
  )
  WITH CHECK (status IN ('Accepted', 'Rejected'));

-- ---------------------------------------------------------------------------
-- Tables already carrying an adequate staff policy alongside the open one —
-- safe to just drop the open one.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "qc_records_full_access" ON public.qc_records;
DROP POLICY IF EXISTS "materials_full_access" ON public.materials;
DROP POLICY IF EXISTS "cutting_records_full_access" ON public.cutting_records;
DROP POLICY IF EXISTS "sewing_bundles_full_access" ON public.sewing_bundles;
DROP POLICY IF EXISTS "wash_batches_full_access" ON public.wash_batches;

-- ---------------------------------------------------------------------------
-- apply_cut_sheets / apply_documents — each currently has the open policy
-- plus a narrow customer-review-status-only policy. Staff need general
-- access (viewing docs/cut sheets for any submission, not just ones stuck
-- in customer review), which nothing currently grants once the open policy
-- is gone.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "apply_cut_sheets_full_access" ON public.apply_cut_sheets;
DROP POLICY IF EXISTS "apply_cut_sheets_staff_all" ON public.apply_cut_sheets;
CREATE POLICY "apply_cut_sheets_staff_all" ON public.apply_cut_sheets
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());
DROP POLICY IF EXISTS "apply_cut_sheets_public_insert" ON public.apply_cut_sheets;
CREATE POLICY "apply_cut_sheets_public_insert" ON public.apply_cut_sheets
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "apply_documents_full_access" ON public.apply_documents;
DROP POLICY IF EXISTS "apply_documents_staff_all" ON public.apply_documents;
CREATE POLICY "apply_documents_staff_all" ON public.apply_documents
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());
DROP POLICY IF EXISTS "apply_documents_public_insert" ON public.apply_documents;
CREATE POLICY "apply_documents_public_insert" ON public.apply_documents
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Tables that were down to the open policy alone — add a staff policy so
-- dropping it doesn't drop staff to zero access instead of just fixing the
-- leak.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sample_requests_full_access" ON public.sample_requests;
DROP POLICY IF EXISTS "sample_requests_staff_all" ON public.sample_requests;
CREATE POLICY "sample_requests_staff_all" ON public.sample_requests
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());
DROP POLICY IF EXISTS "sample_requests_public_insert" ON public.sample_requests;
CREATE POLICY "sample_requests_public_insert" ON public.sample_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "blanket_pos_full_access" ON public.blanket_pos;
DROP POLICY IF EXISTS "blanket_pos_staff_all" ON public.blanket_pos;
CREATE POLICY "blanket_pos_staff_all" ON public.blanket_pos
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "stage_outsourcing_records_full_access" ON public.stage_outsourcing_records;
DROP POLICY IF EXISTS "stage_outsourcing_staff_all" ON public.stage_outsourcing_records;
CREATE POLICY "stage_outsourcing_staff_all" ON public.stage_outsourcing_records
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "migration_exceptions_full_access" ON public.migration_exceptions;
DROP POLICY IF EXISTS "migration_exceptions_staff_all" ON public.migration_exceptions;
CREATE POLICY "migration_exceptions_staff_all" ON public.migration_exceptions
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "rework_logs_full_access" ON public.rework_logs;
DROP POLICY IF EXISTS "rework_logs_staff_all" ON public.rework_logs;
CREATE POLICY "rework_logs_staff_all" ON public.rework_logs
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "size_gate_records_full_access" ON public.size_gate_records;
DROP POLICY IF EXISTS "size_gate_records_staff_all" ON public.size_gate_records;
CREATE POLICY "size_gate_records_staff_all" ON public.size_gate_records
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

-- bundles / scan_events / sku_mappings — already dropped to zero policies
-- by the earlier, partially-successful migration attempt. Currently
-- inaccessible to anyone (staff included) via the anon-key frontend.
DROP POLICY IF EXISTS "bundles_staff_all" ON public.bundles;
CREATE POLICY "bundles_staff_all" ON public.bundles
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "scan_events_staff_all" ON public.scan_events;
CREATE POLICY "scan_events_staff_all" ON public.scan_events
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "sku_mappings_staff_all" ON public.sku_mappings;
CREATE POLICY "sku_mappings_staff_all" ON public.sku_mappings
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "sku_mappings_customer_select" ON public.sku_mappings;
CREATE POLICY "sku_mappings_customer_select" ON public.sku_mappings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(public.sku_mappings.customer_name)
    )
  );

DROP POLICY IF EXISTS "work_orders_full_access" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_staff" ON public.work_orders;
CREATE POLICY "work_orders_staff" ON public.work_orders
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());
