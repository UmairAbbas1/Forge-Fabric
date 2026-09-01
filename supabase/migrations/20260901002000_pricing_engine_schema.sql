-- ============================================================================
-- PRICING & RATES ENGINE — Phase A schema.
--
-- Five new tables replacing every hardcoded/manual-only pricing input with a
-- real, admin-maintained data source: rate_cards, article_cycle_profiles,
-- rush_multiplier_tiers, customer_pricing_rules, sample_pricing_rules — plus
-- a structured extension of the existing price_quotes table so an issued
-- quote stores its full itemized breakdown (traceable/reprintable), not a
-- lump sum.
--
-- Conventions carried over deliberately from the rest of this project rather
-- than invented fresh:
--   - article_type reuses ProductType (ApplyWizardContext.tsx) — the same
--     eight garment categories used everywhere else in intake/orders.
--   - fabric_category reuses WashCategory (wash-compatibility-matrix.ts) —
--     denim / knit / woven / other, the same fabric groupings the wash
--     treatment matrix already uses. resolveWashCategory() is the existing
--     function that resolves a style block to one of these four.
--   - RLS follows has_module_permission(module, action)
--     (20260901000200_role_granular_rls_matrix.sql), extended here with a
--     new 'pricing' module: merchandiser/finance/admin/super_admin can read
--     (they need it for quoting/billing), only finance/admin/super_admin can
--     write. No customer-facing policy exists on any of these five tables —
--     a customer must never see the rate/discount mechanism, only the
--     resulting price on their own quote.
--   - Never hard-deleted: every table carries is_active; deactivate, don't
--     delete, so a rule referenced by an existing quote/invoice stays valid
--     history.
--
-- Idempotent throughout: safe to re-run.
-- ============================================================================

-- ------------------------------------------------------------------------------
-- 0. Extend has_module_permission with a 'pricing' module. Full function body
--    reproduced (CREATE OR REPLACE requires it) — every existing branch is
--    copied byte-for-byte from 20260901000200_role_granular_rls_matrix.sql,
--    only the new 'pricing' WHEN is added.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_module_permission(p_module TEXT, p_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role::varchar INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND coalesce(deactivated, false) = false;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN CASE p_module
    WHEN 'crm' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'warehouse' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'product_master' THEN CASE v_role
      WHEN 'merchandiser' THEN TRUE
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'orders' THEN CASE v_role
      WHEN 'merchandiser' THEN TRUE
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'production_planning' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN TRUE
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'production' THEN TRUE
      ELSE FALSE
    END
    WHEN 'shop_floor' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN TRUE
      WHEN 'cutting_supervisor' THEN p_action IN ('create', 'read', 'update')
      WHEN 'sewing_supervisor' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'qc' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'qc_inspector' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production' THEN p_action = 'read'
      WHEN 'qc' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'inventory' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production_manager' THEN p_action IN ('create', 'read', 'update')
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'warehouse' THEN TRUE
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'shipping' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'warehouse' THEN TRUE
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'finance' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'finance' THEN TRUE
      ELSE FALSE
    END
    -- New: Pricing & Rates admin module (rate_cards, article_cycle_profiles,
    -- rush_multiplier_tiers, customer_pricing_rules, sample_pricing_rules).
    -- Merchandiser needs read access to look up rates while quoting; only
    -- finance (and admin/super_admin, already TRUE above) can create/edit.
    WHEN 'pricing' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'finance' THEN TRUE
      ELSE FALSE
    END
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- ------------------------------------------------------------------------------
-- Shared CHECK value lists, spelled out identically on every table below:
--   article_type: the 8 ProductType values from ApplyWizardContext.tsx
--   fabric_category: the 4 WashCategory values from wash-compatibility-matrix.ts
--   complexity_tier: Simple / Moderate / Complex
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- 1. rate_cards — article type × process × fabric category -> base rate +
--    loaded margin %. One active row per (article_type, process,
--    fabric_category) combination at a time (partial unique index below);
--    effective_date lets a superseding row be added ahead of time.
--
--    Only the 'cmt_base' process row's loaded_margin_percent is read as the
--    quote's overall margin (per the established formula: subtotal + Margin
--    % = Unit Price — margin is applied once, to the CMT+wash+trims
--    subtotal, not per line). wash_surcharge/trims_packaging rows still
--    carry their own loaded_margin_percent for schema uniformity /
--    future flexibility, but the quote engine (Phase D) does not read it.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_type text NOT NULL CHECK (article_type IN (
    'Denim/Bottoms', 'Hoodie/Sweatshirt', 'T-Shirt', 'Jacket', 'Shorts', 'Dress', 'Kidswear', 'Custom/Other'
  )),
  process text NOT NULL CHECK (process IN ('cmt_base', 'wash_surcharge', 'trims_packaging')),
  fabric_category text NOT NULL CHECK (fabric_category IN ('denim', 'knit', 'woven', 'other')),
  base_rate_usd numeric(10,2) NOT NULL CHECK (base_rate_usd >= 0),
  loaded_margin_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (loaded_margin_percent >= 0 AND loaded_margin_percent <= 500),
  is_active boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_cards_active_combo
  ON public.rate_cards (article_type, process, fabric_category)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_rate_cards_lookup
  ON public.rate_cards (article_type, fabric_category, is_active);

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_cards_staff_read" ON public.rate_cards;
CREATE POLICY "rate_cards_staff_read" ON public.rate_cards
  FOR SELECT TO authenticated
  USING (public.has_module_permission('pricing', 'read'));

DROP POLICY IF EXISTS "rate_cards_admin_finance_write" ON public.rate_cards;
CREATE POLICY "rate_cards_admin_finance_write" ON public.rate_cards
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_permission('pricing', 'create'));

DROP POLICY IF EXISTS "rate_cards_admin_finance_update" ON public.rate_cards;
CREATE POLICY "rate_cards_admin_finance_update" ON public.rate_cards
  FOR UPDATE TO authenticated
  USING (public.has_module_permission('pricing', 'update'))
  WITH CHECK (public.has_module_permission('pricing', 'update'));

-- No DELETE policy — never hard-deleted, only deactivated via UPDATE.

-- ------------------------------------------------------------------------------
-- 2. article_cycle_profiles — one active row per article_type: its
--    complexity tier and real units-per-shift throughput. Feeds both Phase C
--    rush feasibility and the rush multiplier lookup (via complexity_tier).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_cycle_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_type text NOT NULL CHECK (article_type IN (
    'Denim/Bottoms', 'Hoodie/Sweatshirt', 'T-Shirt', 'Jacket', 'Shorts', 'Dress', 'Kidswear', 'Custom/Other'
  )),
  complexity_tier text NOT NULL CHECK (complexity_tier IN ('Simple', 'Moderate', 'Complex')),
  units_per_shift integer NOT NULL CHECK (units_per_shift > 0),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_article_cycle_profiles_active_article
  ON public.article_cycle_profiles (article_type)
  WHERE is_active;

ALTER TABLE public.article_cycle_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "article_cycle_profiles_staff_read" ON public.article_cycle_profiles;
CREATE POLICY "article_cycle_profiles_staff_read" ON public.article_cycle_profiles
  FOR SELECT TO authenticated
  USING (public.has_module_permission('pricing', 'read'));

DROP POLICY IF EXISTS "article_cycle_profiles_admin_finance_write" ON public.article_cycle_profiles;
CREATE POLICY "article_cycle_profiles_admin_finance_write" ON public.article_cycle_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_permission('pricing', 'create'));

DROP POLICY IF EXISTS "article_cycle_profiles_admin_finance_update" ON public.article_cycle_profiles;
CREATE POLICY "article_cycle_profiles_admin_finance_update" ON public.article_cycle_profiles
  FOR UPDATE TO authenticated
  USING (public.has_module_permission('pricing', 'update'))
  WITH CHECK (public.has_module_permission('pricing', 'update'));

-- ------------------------------------------------------------------------------
-- 3. rush_multiplier_tiers — one active multiplier per complexity_tier.
--    Replaces the old flat tenant_config.rush_multiplier (which stays in
--    place as a legacy fallback only until Phase D's quote engine rewire is
--    complete — not touched by this migration).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rush_multiplier_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complexity_tier text NOT NULL CHECK (complexity_tier IN ('Simple', 'Moderate', 'Complex')),
  multiplier numeric(4,2) NOT NULL CHECK (multiplier >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rush_multiplier_tiers_active_tier
  ON public.rush_multiplier_tiers (complexity_tier)
  WHERE is_active;

ALTER TABLE public.rush_multiplier_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rush_multiplier_tiers_staff_read" ON public.rush_multiplier_tiers;
CREATE POLICY "rush_multiplier_tiers_staff_read" ON public.rush_multiplier_tiers
  FOR SELECT TO authenticated
  USING (public.has_module_permission('pricing', 'read'));

DROP POLICY IF EXISTS "rush_multiplier_tiers_admin_finance_write" ON public.rush_multiplier_tiers;
CREATE POLICY "rush_multiplier_tiers_admin_finance_write" ON public.rush_multiplier_tiers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_permission('pricing', 'create'));

DROP POLICY IF EXISTS "rush_multiplier_tiers_admin_finance_update" ON public.rush_multiplier_tiers;
CREATE POLICY "rush_multiplier_tiers_admin_finance_update" ON public.rush_multiplier_tiers
  FOR UPDATE TO authenticated
  USING (public.has_module_permission('pricing', 'update'))
  WITH CHECK (public.has_module_permission('pricing', 'update'));

-- ------------------------------------------------------------------------------
-- 4. customer_pricing_rules — company-scoped standing discount. discount_type
--    is deliberately free text (not CHECK-constrained to a fixed list) so a
--    future 'custom_rate' type can be introduced with zero migration needed
--    to loosen a constraint — but only 'percent' is recognized/implemented
--    by any application code today (enforced at the application layer, see
--    useCustomerPricingRules.ts). Per the constraint in this task: do not
--    build full custom per-article negotiated rates now — schema-ready only.
--
--    RLS never grants the customer role read access on this table at all —
--    a customer must see the resulting price on their own quote, never the
--    discount mechanism that produced it. has_module_permission('pricing',_)
--    already returns FALSE for role='customer' (it isn't one of the CASE
--    branches), so this falls out of the same policy as every other table
--    here rather than needing a special exclusion.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_percent numeric(5,2) CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_pricing_rules_date_order CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_customer_pricing_rules_company ON public.customer_pricing_rules (company_id, is_active);

ALTER TABLE public.customer_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_pricing_rules_staff_read" ON public.customer_pricing_rules;
CREATE POLICY "customer_pricing_rules_staff_read" ON public.customer_pricing_rules
  FOR SELECT TO authenticated
  USING (public.has_module_permission('pricing', 'read'));

DROP POLICY IF EXISTS "customer_pricing_rules_admin_finance_write" ON public.customer_pricing_rules;
CREATE POLICY "customer_pricing_rules_admin_finance_write" ON public.customer_pricing_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_permission('pricing', 'create'));

DROP POLICY IF EXISTS "customer_pricing_rules_admin_finance_update" ON public.customer_pricing_rules;
CREATE POLICY "customer_pricing_rules_admin_finance_update" ON public.customer_pricing_rules
  FOR UPDATE TO authenticated
  USING (public.has_module_permission('pricing', 'update'))
  WITH CHECK (public.has_module_permission('pricing', 'update'));

-- ------------------------------------------------------------------------------
-- 5. sample_pricing_rules — deliberately simpler than the bulk rate-card
--    model: a flat fee and/or a per-unit rate, nothing else. Sample Requests
--    already cap at a small fixed quantity (see apply_submissions/
--    sample_requests governance) so there is no complexity tier, fabric
--    category, or rush multiplier dimension to model here — one active rule
--    at a time is enough (article_type-scoped, since a jacket sample and a
--    t-shirt sample genuinely cost different amounts to produce).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sample_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_type text NOT NULL CHECK (article_type IN (
    'Denim/Bottoms', 'Hoodie/Sweatshirt', 'T-Shirt', 'Jacket', 'Shorts', 'Dress', 'Kidswear', 'Custom/Other'
  )),
  flat_fee_usd numeric(10,2) CHECK (flat_fee_usd IS NULL OR flat_fee_usd >= 0),
  per_unit_rate_usd numeric(10,2) CHECK (per_unit_rate_usd IS NULL OR per_unit_rate_usd >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sample_pricing_rules_has_a_price CHECK (flat_fee_usd IS NOT NULL OR per_unit_rate_usd IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sample_pricing_rules_active_article
  ON public.sample_pricing_rules (article_type)
  WHERE is_active;

ALTER TABLE public.sample_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sample_pricing_rules_staff_read" ON public.sample_pricing_rules;
CREATE POLICY "sample_pricing_rules_staff_read" ON public.sample_pricing_rules
  FOR SELECT TO authenticated
  USING (public.has_module_permission('pricing', 'read'));

DROP POLICY IF EXISTS "sample_pricing_rules_admin_finance_write" ON public.sample_pricing_rules;
CREATE POLICY "sample_pricing_rules_admin_finance_write" ON public.sample_pricing_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module_permission('pricing', 'create'));

DROP POLICY IF EXISTS "sample_pricing_rules_admin_finance_update" ON public.sample_pricing_rules;
CREATE POLICY "sample_pricing_rules_admin_finance_update" ON public.sample_pricing_rules
  FOR UPDATE TO authenticated
  USING (public.has_module_permission('pricing', 'update'))
  WITH CHECK (public.has_module_permission('pricing', 'update'));

-- ------------------------------------------------------------------------------
-- 6. price_quotes — extend with structured columns for the full itemized
--    breakdown and its provenance, rather than only the already-existing
--    lump figures (cmt_unit_cost/wash_unit_cost/trims_unit_cost/
--    factory_margin_pct/final_unit_price/total_contract_value, added in
--    20260823000000_v2_spec_production_upgrade.sql). All nullable: a quote
--    built with no matching rate card (manual entry, per Phase D item 5)
--    simply leaves the provenance columns null — never a fabricated link.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.price_quotes
  ADD COLUMN IF NOT EXISTS rate_card_id uuid REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fabric_category text CHECK (fabric_category IS NULL OR fabric_category IN ('denim', 'knit', 'woven', 'other')),
  ADD COLUMN IF NOT EXISTS complexity_tier text CHECK (complexity_tier IS NULL OR complexity_tier IN ('Simple', 'Moderate', 'Complex')),
  ADD COLUMN IF NOT EXISTS rush_multiplier_applied numeric(4,2),
  ADD COLUMN IF NOT EXISTS customer_pricing_rule_id uuid REFERENCES public.customer_pricing_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_discount_percent_applied numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sample_pricing_rule_id uuid REFERENCES public.sample_pricing_rules(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 7. Audit trail for customer_pricing_rules — reuses the existing audit_logs
--    table (20260901000000_audit_logs.sql) as-is, no schema change needed.
--    target_id/target_email stay NULL (they're profiles-shaped, and the
--    target here is a company, not a user); the company is recorded in
--    `details` instead. Actions used: 'customer_pricing_rule_created',
--    'customer_pricing_rule_updated', 'customer_pricing_rule_deactivated'.
--    Written by the application (useCustomerPricingRules.ts) at the same
--    time as each write to customer_pricing_rules — audit_logs' own RLS
--    (admin_insert, actor_id = auth.uid()) already covers who may write, but
--    admin-only insert would block finance-role writes that
--    customer_pricing_rules itself permits. Extend audit_logs' insert policy
--    the same way rate_cards etc. above use has_module_permission, rather
--    than leaving finance-authored pricing changes unaudited.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_admin_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
      actor_id = auth.uid()
      AND (public.is_admin_user() OR public.has_module_permission('pricing', 'create'))
    );
