-- ============================================================================
-- style_templates — reusable, named snapshots of a fully-configured style
-- block (fabric type, wash type, sizes, trims BOM, per-service details),
-- so a customer or merchandiser can start a new order/line from a saved
-- configuration instead of re-entering it from scratch.
--
-- Owner scoping: a template can belong to either a customer's company
-- (company_id, shared across everyone on that brand's account) or an
-- internal staff member (created_by_user_id) — exactly one of the two is
-- ever set. Staff templates are visible to ALL staff (mirroring the
-- established is_internal_staff() broad-access pattern already used for
-- qc_records_staff_all/materials_staff_all/etc. elsewhere in this project
-- — a merchandiser's saved template is useful to any colleague, not just
-- its creator); customer templates are strictly scoped to that customer's
-- own company, same isolation principle as everything else customer-facing
-- in this project.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.style_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  -- The full style-block specification (fabric_type, wash_type, size
  -- columns/matrix, trims_bom, cutting/sewing/wash/finishing/packing
  -- details, etc.) — one JSON document, mirroring how apply_submissions
  -- already stores style_blocks, so the same shape round-trips straight
  -- back into StyleBlockItem with no field-by-field mapping layer.
  style_block jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT style_templates_owner_check CHECK (
    (company_id IS NOT NULL AND created_by_user_id IS NULL)
    OR (company_id IS NULL AND created_by_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_style_templates_company_id ON public.style_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_style_templates_created_by ON public.style_templates(created_by_user_id);

ALTER TABLE public.style_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "style_templates_staff_all" ON public.style_templates;
CREATE POLICY "style_templates_staff_all" ON public.style_templates
  FOR ALL TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

DROP POLICY IF EXISTS "style_templates_customer_own" ON public.style_templates;
CREATE POLICY "style_templates_customer_own" ON public.style_templates
  FOR ALL TO authenticated
  USING (company_id IS NOT NULL AND company_id = public.get_auth_user_company_id())
  WITH CHECK (company_id IS NOT NULL AND company_id = public.get_auth_user_company_id());
