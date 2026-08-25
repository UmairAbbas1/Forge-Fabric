-- ==============================================================================
-- Customer-review-and-approval step for merchandiser/admin-created orders
-- (Internal Order Intake, /apply-intake, when the submitter is staff, not
-- the customer themselves). The public self-submission flow (/apply/new,
-- and /apply-intake when a customer submits their own order) is completely
-- unaffected by this migration — every change here is additive (new
-- column, new narrowly-scoped SELECT policies for two tables). Nothing
-- existing is altered or dropped.
-- ==============================================================================

-- Who authored this submission internally (NULL for every customer-authored
-- row, exactly as today) — lets the app notify the right merchandiser back
-- when the customer approves/rejects, and show "awaiting customer" vs
-- "customer rejected" in that merchandiser's own Submissions Inbox.
ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apply_submissions_created_by_staff
  ON public.apply_submissions(created_by_staff_id);

-- apply_submissions.status has no CHECK constraint (see the column comment
-- in 20260714000400_apply_portal_schema.sql) — 'pending_customer_review'
-- and 'customer_rejected' are new documented values, added the same
-- unconstrained way 'converted'/'rejected'/'needs_info' were.

-- The customer's read-only review screen needs to see the cut sheet and
-- documents the merchandiser entered on their behalf — both tables are
-- staff-only today (apply_cut_sheets_staff_all / apply_documents_staff_all,
-- both `USING (is_internal_staff())`). These two additive SELECT grants let
-- a customer read a cut sheet/document only when: it belongs to a
-- submission for THEIR OWN company, AND that submission is actually in the
-- customer-review lifecycle right now (pending_customer_review while
-- awaiting their decision, or customer_rejected so they can still see what
-- they rejected). Submissions in every other status (pending_review,
-- under_review, needs_info, the normal staff-only queue) remain completely
-- inaccessible to customers, exactly as before this migration.
DROP POLICY IF EXISTS "apply_cut_sheets_customer_review_select" ON public.apply_cut_sheets;
CREATE POLICY "apply_cut_sheets_customer_review_select" ON public.apply_cut_sheets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.id = apply_cut_sheets.submission_id
        AND s.status IN ('pending_customer_review', 'customer_rejected')
        AND lower(s.company_name) = lower(c.name)
    )
  );

DROP POLICY IF EXISTS "apply_documents_customer_review_select" ON public.apply_documents;
CREATE POLICY "apply_documents_customer_review_select" ON public.apply_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apply_submissions s
      JOIN public.companies c ON c.id = public.get_auth_user_company_id()
      WHERE s.id = apply_documents.submission_id
        AND s.status IN ('pending_customer_review', 'customer_rejected')
        AND lower(s.company_name) = lower(c.name)
    )
  );
