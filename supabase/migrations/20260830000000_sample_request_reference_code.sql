-- ==============================================================================
-- sample_requests has never had a real apply_reference_code column — only
-- apply_submissions does. The merchandiser sample-decision panel
-- (SampleRequestDetails.tsx) was building its status-update filter as
-- `.or('id.eq.<id>,apply_reference_code.eq.<code>')` against sample_requests,
-- which PostgREST rejects outright (unknown column) — silently swallowed by
-- a bare try/catch, so Approve/Reject never actually persisted for any
-- sample sourced from this table. The UI's displayed reference code
-- ("SR-xxxxxx") was a client-side-only fallback with no real column behind
-- it, so it also could never be matched by the customer notification-routing
-- logic in useAppData.tsx (which keys off a real apply_reference_code column
-- the same way the already-working bulk-order flow does).
--
-- This adds a real column, backfilled with the exact same "SR-" + first 6 id
-- chars format the UI was already displaying (so no reference code visible
-- to any user changes), and a trigger to populate it the same way for every
-- future insert.
-- ==============================================================================

ALTER TABLE IF EXISTS public.sample_requests
  ADD COLUMN IF NOT EXISTS apply_reference_code text;

UPDATE public.sample_requests
SET apply_reference_code = 'SR-' || substring(id::text, 1, 6)
WHERE apply_reference_code IS NULL;

CREATE OR REPLACE FUNCTION public.set_sample_request_reference_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.apply_reference_code IS NULL OR NEW.apply_reference_code = '' THEN
    NEW.apply_reference_code := 'SR-' || substring(NEW.id::text, 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_sample_request_reference_code ON public.sample_requests;
CREATE TRIGGER trg_set_sample_request_reference_code
  BEFORE INSERT ON public.sample_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_sample_request_reference_code();

CREATE INDEX IF NOT EXISTS idx_sample_requests_reference_code
  ON public.sample_requests(apply_reference_code);
