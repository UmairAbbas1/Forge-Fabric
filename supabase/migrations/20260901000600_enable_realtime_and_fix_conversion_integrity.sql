-- ============================================================================
-- Root-cause fix for two related bugs reported against the Submission Inbox
-- / Order Conversion flow:
--
-- 1. "Submission dashboard is not updating with backend" — every realtime
--    listener the app already has code for (apply_submissions, orders,
--    blanket_pos, work_orders, etc.) was silently a no-op, because none of
--    these tables were ever added to Supabase's `supabase_realtime`
--    publication. The client subscribes successfully (status: SUBSCRIBED)
--    but Postgres never actually sends change events for unpublished
--    tables — confirmed live: an UPDATE on apply_submissions produced zero
--    postgres_changes events on a subscribed channel before this migration.
--    This is why merchandisers saw a submission still marked "Pending
--    Review" with an active Convert button after it had already been
--    converted, and clicked Convert again.
--
-- 2. That repeat-click, combined with useConvertSubmission.ts having no
--    duplicate-conversion guard, produced 5 separate Blanket PO contracts
--    for one submission (APP-2026-0069 / Aqtiv), only 1 of which ended up
--    with a matching real production order (the other 4 conversion
--    attempts silently "succeeded" in the UI because the order write was
--    fire-and-forget and never awaited — fixed separately in
--    useConvertSubmission.ts / useAppData.tsx).
--
-- This migration: (a) enables realtime replication on every table the
-- frontend already has live-subscription code for, (b) adds a real link
-- from orders back to the submission it was converted from so the
-- orders.tsx duplicate-row check can match exactly instead of guessing,
-- (c) cleans up the existing duplicate Blanket PO rows, and (d) adds a
-- unique constraint so a submission can never be converted twice again.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (a) Enable Postgres Realtime replication.
-- Every table below already has working `.channel(...).on('postgres_changes', ...)`
-- client code in this app (apply_submissions in useSubmissions.ts, orders in
-- useAppData.tsx/useSkuMappings.ts, blanket_pos/work_orders/stage_outsourcing_records/
-- outsource_return_qc/invoicing_records in useAppData.tsx, etc.) — none of it has
-- ever fired an event because the tables were never published. This is additive
-- and safe: it does not change RLS, data, or any existing query.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'apply_submissions',
    'orders',
    'update_requests',
    'sku_mappings',
    'notification_logs',
    'notifications',
    'materials',
    'work_orders',
    'stage_outsourcing_records',
    'outsource_return_qc',
    'blanket_pos',
    'invoicing_records',
    'sample_requests',
    'qc_inspections',
    'qc_records',
    'stage_jump_logs',
    'raw_materials_intake',
    'packing_lists'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- (b) Link orders back to the submission they were converted from.
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS apply_reference_code text;
CREATE INDEX IF NOT EXISTS idx_orders_apply_reference_code ON public.orders(apply_reference_code);

-- Backfill from the existing real link: orders.po_number = blanket_pos.po_number,
-- and blanket_pos.apply_reference_code already carries the submission reference.
UPDATE public.orders o
SET apply_reference_code = bp.apply_reference_code
FROM public.blanket_pos bp
WHERE o.po_number = bp.po_number
  AND bp.apply_reference_code IS NOT NULL
  AND o.apply_reference_code IS NULL;

-- ----------------------------------------------------------------------------
-- (c) Clean up existing duplicate Blanket PO contracts (currently only
-- APP-2026-0069 / Aqtiv, verified live: 5 rows for one submission, only one
-- of which — PO-2026-96 — has a matching real order). For each
-- apply_reference_code, keep the row that has a matching real order if one
-- exists, otherwise the earliest-created row, and delete the rest.
-- ----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    bp.id,
    ROW_NUMBER() OVER (
      PARTITION BY bp.apply_reference_code
      ORDER BY
        (EXISTS (SELECT 1 FROM public.orders o WHERE o.po_number = bp.po_number)) DESC,
        bp.created_at ASC
    ) AS rn
  FROM public.blanket_pos bp
  WHERE bp.apply_reference_code IS NOT NULL
)
DELETE FROM public.blanket_pos
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ----------------------------------------------------------------------------
-- (d) Prevent this from ever happening again. The application-level guard
-- added to useConvertSubmission.ts (re-checks submission status before
-- converting) is the primary fix; this is the DB-level backstop for a
-- second tab, a retried request, or any future code path that bypasses it.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_blanket_pos_unique_apply_reference_code
  ON public.blanket_pos(apply_reference_code)
  WHERE apply_reference_code IS NOT NULL;
