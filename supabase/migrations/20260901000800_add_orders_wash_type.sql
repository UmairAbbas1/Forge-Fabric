-- Adds a real wash_type column to orders. Previously the customer's actual
-- wash-type selection only ever lived as a text fragment inside
-- orders.notes ("Service: Raw / Rigid...") — never a queryable field — so
-- the actual washing production stage (src/routes/wash.tsx) had nothing to
-- read and never displayed the customer's real, per-order wash type at all.
--
-- Idempotent: safe to run more than once.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wash_type text;

COMMENT ON COLUMN public.orders.wash_type IS
  'Customer-selected wash type for this order/style-block line (e.g. Stone Wash, Enzyme Wash). NULL means washing was never part of this order''s selected services — not a default/guessed value.';
