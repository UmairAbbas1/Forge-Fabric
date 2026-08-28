-- ============================================================================
-- FORGE & FABRIC INDUSTRIES: REAL-TIME SUBMISSIONS & ORDERS ALIGNMENT MIGRATION
-- ============================================================================

-- 1. Ensure all required columns exist on public.apply_submissions
ALTER TABLE public.apply_submissions 
  ADD COLUMN IF NOT EXISTS requested_stages INT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS starting_stage INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS rush_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS converted_to_po_id UUID REFERENCES public.blanket_pos(id) ON DELETE SET NULL;

-- 2. Ensure all required columns exist on public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS selected_stages INT[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12,13}',
  ADD COLUMN IF NOT EXISTS current_stage INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS rush_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_order_id TEXT DEFAULT NULL;

-- 3. Synchronize status for any existing converted submissions
UPDATE public.apply_submissions
SET 
  status = 'converted',
  reviewed_at = COALESCE(reviewed_at, NOW()),
  updated_at = NOW()
WHERE 
  converted_to_po_id IS NOT NULL 
  AND status != 'converted';

-- 4. Sync APP-2026-0069 specifically with its blanket PO
UPDATE public.apply_submissions
SET 
  status = 'converted',
  converted_to_po_id = 'c854719c-b84e-4b39-a417-99245876df53',
  reviewed_at = COALESCE(reviewed_at, NOW()),
  updated_at = NOW()
WHERE 
  apply_reference_code = 'APP-2026-0069';

-- 5. Enable Supabase Realtime replication on public tables
DO $$
BEGIN
  -- Add apply_submissions to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'apply_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.apply_submissions;
  END IF;

  -- Add orders to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  -- Add blanket_pos to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'blanket_pos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blanket_pos;
  END IF;
END $$;

-- 6. Verify table indices for lightning-fast lookups
CREATE INDEX IF NOT EXISTS idx_apply_submissions_status ON public.apply_submissions(status);
CREATE INDEX IF NOT EXISTS idx_apply_submissions_ref_code ON public.apply_submissions(apply_reference_code);
CREATE INDEX IF NOT EXISTS idx_orders_current_stage ON public.orders(current_stage);
CREATE INDEX IF NOT EXISTS idx_orders_po_number ON public.orders(po_number);

COMMENT ON TABLE public.apply_submissions IS 'Order intake submissions synchronized in real-time with Merchandiser Portal and Production Pipelines';
