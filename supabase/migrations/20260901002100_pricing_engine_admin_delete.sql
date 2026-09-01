-- ============================================================================
-- Pricing & Rates engine — admin-only hard-delete policy.
--
-- The application itself never hard-deletes a pricing rule that might be
-- referenced by an existing quote/invoice — every mutation hook
-- (useRateCards.ts, useRushPricing.ts, useCustomerPricingRules.ts,
-- useSamplePricingRules.ts) only ever calls UPDATE (is_active = false) to
-- deactivate, and the admin UI (/settings/pricing) has no delete button at
-- all. This migration does not change that.
--
-- What it adds is a genuine DB-level DELETE policy restricted to
-- is_admin_user() (admin/super_admin only, narrower than the finance-role
-- write access these tables otherwise grant) — the same precedent already
-- established for companies_staff_delete ("admin-only, already correct",
-- per 20260901000200_role_granular_rls_matrix.sql's own comments). This is
-- for legitimate administrative data-hygiene use (e.g. removing a rule
-- created by mistake with no real quotes against it yet, or E2E/test-data
-- cleanup) via direct DB access — not something the app's own UI exposes.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP POLICY IF EXISTS "rate_cards_admin_delete" ON public.rate_cards;
CREATE POLICY "rate_cards_admin_delete" ON public.rate_cards
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "article_cycle_profiles_admin_delete" ON public.article_cycle_profiles;
CREATE POLICY "article_cycle_profiles_admin_delete" ON public.article_cycle_profiles
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "rush_multiplier_tiers_admin_delete" ON public.rush_multiplier_tiers;
CREATE POLICY "rush_multiplier_tiers_admin_delete" ON public.rush_multiplier_tiers
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "customer_pricing_rules_admin_delete" ON public.customer_pricing_rules;
CREATE POLICY "customer_pricing_rules_admin_delete" ON public.customer_pricing_rules
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "sample_pricing_rules_admin_delete" ON public.sample_pricing_rules;
CREATE POLICY "sample_pricing_rules_admin_delete" ON public.sample_pricing_rules
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- price_quotes and apply_submissions/orders test rows also need cleanup
-- capability. price_quotes already has price_quotes_staff_all (FOR ALL,
-- is_internal_staff()) which already covers DELETE — no change needed
-- there. apply_submissions and orders: check existing policies before
-- assuming; both already have broad internal-staff/admin policies from
-- earlier migrations in this project that predate the pricing engine and
-- are unrelated to it, so they are intentionally left untouched here.
