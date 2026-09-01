-- ============================================================================
-- Pricing & Rates engine — Phase F fix: enable Supabase Realtime broadcast
-- for the 5 new tables.
--
-- useAppData.tsx already subscribes to postgres_changes on rate_cards,
-- article_cycle_profiles, rush_multiplier_tiers, customer_pricing_rules,
-- and sample_pricing_rules (20260901002000_pricing_engine_schema.sql's
-- companion frontend change) and invalidates the matching React Query keys
-- — but a table only actually EMITS postgres_changes events once it's
-- added to the supabase_realtime publication. RLS/subscription code being
-- correct is not sufficient on its own; this was the missing piece (caught
-- by the Phase G E2E realtime test actually failing against the live
-- database, not assumed to work).
--
-- Idempotent: guarded by pg_publication_tables, matching the exact pattern
-- already used for every other table in this project (see
-- 20260816000000_pipeline_integrity_fixes.sql).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rate_cards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rate_cards;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'article_cycle_profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.article_cycle_profiles;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rush_multiplier_tiers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rush_multiplier_tiers;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customer_pricing_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_pricing_rules;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sample_pricing_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sample_pricing_rules;
  END IF;
END$$;
