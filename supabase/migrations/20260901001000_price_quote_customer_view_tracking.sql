-- ============================================================================
-- PRICE QUOTE CUSTOMER-DASHBOARD FLOW
--
-- The merchandiser's "Send Quote to Customer" action (PricingQuoteModal.tsx)
-- already writes a real price_quotes row with status='Sent_To_Customer', and
-- price_quotes_customer_select/_respond RLS policies (added in
-- 20260823000000_v2_spec_production_upgrade.sql) already let the customer's
-- own logged-in session read and Accept/Reject it. The gap was purely
-- frontend: nothing in the authenticated customer experience ever queried
-- price_quotes, so quotes were only ever visible on the separate, no-login
-- /apply/status/$referenceCode page.
--
-- This migration adds the one piece of new state needed for the requested
-- flow: "the quote appears once as a dashboard alert, then disappears from
-- the dashboard (but never from Finance) once the customer has seen it."
-- customer_viewed_at records that one-time acknowledgment, independent of
-- the Accept/Reject decision (a customer can view now, decide later — the
-- decision stays available from Finance regardless of whether the alert
-- tile has already been dismissed).
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE IF EXISTS public.price_quotes
  ADD COLUMN IF NOT EXISTS customer_viewed_at timestamptz;

-- Narrow, single-purpose RPC (mirrors respond_to_price_quote's shape) rather
-- than widening the existing price_quotes_customer_respond UPDATE policy —
-- that policy's WITH CHECK deliberately only allows status to move to
-- Accepted/Rejected, and marking "viewed" must not require or imply either
-- of those decisions.
CREATE OR REPLACE FUNCTION public.mark_price_quote_viewed(p_quote_id uuid)
RETURNS public.price_quotes AS $$
DECLARE
  v_quote public.price_quotes;
BEGIN
  UPDATE public.price_quotes q
  SET customer_viewed_at = COALESCE(q.customer_viewed_at, now())
  WHERE q.id = p_quote_id
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(q.customer_name)
    )
  RETURNING q.* INTO v_quote;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'Quote not found or does not belong to your company.';
  END IF;

  RETURN v_quote;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Authenticated customers only — this is the logged-in dashboard flow, not
-- the no-login public status page (that path uses respond_to_price_quote,
-- granted to anon separately, with its own reference-code+email proof).
GRANT EXECUTE ON FUNCTION public.mark_price_quote_viewed(uuid) TO authenticated;
