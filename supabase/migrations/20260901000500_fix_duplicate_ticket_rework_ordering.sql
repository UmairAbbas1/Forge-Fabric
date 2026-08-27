-- ============================================================================
-- FIX: duplicate-ticket rework exception used an unreliable "latest verdict"
-- ordering — qc_records has no timestamp column, only a day-granularity
-- inspected_date. Found via live testing: FF-2026-00001 has 10 Inline
-- Sewing QC records all logged "2026-08-25", oscillating Pass/Rework/Pass —
-- "ORDER BY inspected_date DESC LIMIT 1" is non-deterministic among same-day
-- rows, so the rework exception silently picked an arbitrary row instead of
-- the genuinely most recent one, incorrectly blocking a legitimate redo.
--
-- Adds a real created_at timestamp (defaults existing rows to now() — an
-- honest limitation: true historical order among same-day legacy rows can't
-- be recovered since the data never captured it, but every row from this
-- point forward orders correctly), and updates both duplicate-ticket guard
-- triggers to order by it.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.qc_records ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_sewing_ticket()
RETURNS trigger AS $$
DECLARE
  v_existing_count int;
  v_latest_qc_result text;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM public.sewing_tickets t
  WHERE t.work_order_id = NEW.work_order_id;

  IF v_existing_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT result INTO v_latest_qc_result
  FROM public.qc_records
  WHERE order_id = NEW.work_order_id AND stage_checkpoint = 'Inline Sewing QC'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_latest_qc_result IS DISTINCT FROM 'Reject' AND v_latest_qc_result IS DISTINCT FROM 'Rework' THEN
    RAISE EXCEPTION 'A sewing ticket already exists for order % and has not been marked for rework via Inline Sewing QC. Complete or resolve the existing ticket instead of creating a duplicate.', NEW.work_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_cut_ticket()
RETURNS trigger AS $$
DECLARE
  v_existing_count int;
  v_latest_qc_result text;
BEGIN
  SELECT count(*) INTO v_existing_count
  FROM public.cut_tickets t
  WHERE t.work_order_id = NEW.work_order_id;

  IF v_existing_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT result INTO v_latest_qc_result
  FROM public.qc_records
  WHERE order_id = NEW.work_order_id AND stage_checkpoint = 'First Cut Approval'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_latest_qc_result IS DISTINCT FROM 'Reject' AND v_latest_qc_result IS DISTINCT FROM 'Rework' THEN
    RAISE EXCEPTION 'A cut ticket already exists for order % and has not been marked for rework via First Cut Approval. Complete or resolve the existing ticket instead of creating a duplicate.', NEW.work_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
