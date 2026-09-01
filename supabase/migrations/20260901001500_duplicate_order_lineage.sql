-- ============================================================================
-- duplicated_from_order_id — lineage tracking for "Duplicate This Order".
--
-- When a customer or staff member duplicates an existing order (order
-- detail page → "Duplicate This Order"), the new intake draft is seeded
-- from that order's full technical specification and, once submitted,
-- carries a reference back to the order it was cloned from — so the
-- submissions inbox and order detail views can show "Duplicated from
-- ORD-XXXX" instead of presenting it as an unrelated new application.
--
-- References orders.order_id (a text primary key, not a uuid — see
-- 20260714000000_init_schema.sql). ON DELETE SET NULL: if the source order
-- is ever deleted, the duplicate itself remains valid, just loses the
-- back-reference rather than being blocked or cascaded away.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.apply_submissions
  ADD COLUMN IF NOT EXISTS duplicated_from_order_id text REFERENCES public.orders(order_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apply_submissions_duplicated_from_order_id
  ON public.apply_submissions(duplicated_from_order_id)
  WHERE duplicated_from_order_id IS NOT NULL;
