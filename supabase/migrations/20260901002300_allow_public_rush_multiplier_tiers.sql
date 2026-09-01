-- ============================================================================
-- Allow Public / Anon and Customer Read Access on Rush Pricing & Cycle Profiles
-- Root cause fix: Intake portal (/apply/new) and customer review need to fetch
-- real-time multiplier tiers (Simple, Moderate, Complex) and cycle profiles
-- directly from the backend without being blocked by staff-only RLS policies.
-- ============================================================================

-- 1. rush_multiplier_tiers: allow all roles (anon, authenticated) to SELECT active tiers
DROP POLICY IF EXISTS "rush_multiplier_tiers_staff_read" ON public.rush_multiplier_tiers;
DROP POLICY IF EXISTS "rush_multiplier_tiers_read_all" ON public.rush_multiplier_tiers;
CREATE POLICY "rush_multiplier_tiers_read_all" ON public.rush_multiplier_tiers
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. article_cycle_profiles: allow all roles (anon, authenticated) to SELECT active profiles
DROP POLICY IF EXISTS "article_cycle_profiles_staff_read" ON public.article_cycle_profiles;
DROP POLICY IF EXISTS "article_cycle_profiles_read_all" ON public.article_cycle_profiles;
CREATE POLICY "article_cycle_profiles_read_all" ON public.article_cycle_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. sample_pricing_rules: allow all roles (anon, authenticated) to SELECT active sample pricing
DROP POLICY IF EXISTS "sample_pricing_rules_staff_read" ON public.sample_pricing_rules;
DROP POLICY IF EXISTS "sample_pricing_rules_read_all" ON public.sample_pricing_rules;
CREATE POLICY "sample_pricing_rules_read_all" ON public.sample_pricing_rules
  FOR SELECT TO anon, authenticated
  USING (true);

-- Ensure Realtime publication includes these tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rush_multiplier_tiers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rush_multiplier_tiers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'article_cycle_profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.article_cycle_profiles;
  END IF;
END $$;
