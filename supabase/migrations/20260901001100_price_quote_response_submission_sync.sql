-- ============================================================================
-- PRICE QUOTE ACCEPT/REJECT -> SUBMISSION FOLLOW-THROUGH
--
-- Before this migration, an authenticated customer's Accept/Reject only
-- ever flipped price_quotes.status (via a direct client-side UPDATE, legal
-- under the existing price_quotes_customer_respond RLS policy). Nothing
-- propagated that decision back to the apply_submissions row the quote was
-- issued against, so:
--   - A rejected quote left the submission looking exactly as "active" as
--     before, so it kept appearing in the customer's own Active Production
--     Orders / Active Intake lists (orders.tsx) with no indication anything
--     was declined, and the merchandiser had no signal to follow up.
--   - An accepted quote gave the merchandiser no visible confirmation on
--     the submission detail panel that they could now proceed to "Approve
--     PO & Convert to Work Orders".
--
-- This adds one RPC that does both writes atomically, scoped to the
-- caller's own company exactly like respond_to_price_quote (the no-login
-- sibling) and mark_price_quote_viewed. It intentionally does NOT reuse the
-- apply_submissions_update_all policy some earlier migration left open —
-- see the security notes elsewhere in this codebase's history about that
-- policy — a SECURITY DEFINER function scoped by company match is the
-- correct, narrow way to make this write regardless of that policy's fate.
--
-- pricing_status values introduced: 'Pricing_Accepted', 'Pricing_Rejected'
-- (kept in the existing Title_Case convention alongside 'Not_Required' /
-- 'Pending_Pricing_Approval'). apply_submissions.status itself is left
-- untouched — 'customer_rejected' already means something different
-- (customer declined a merchandiser-drafted order for revision, a separate
-- flow from pricing), so it must not be repurposed here.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_price_quote_authenticated(
  p_quote_id uuid,
  p_response text
)
RETURNS public.price_quotes AS $$
DECLARE
  v_quote public.price_quotes;
BEGIN
  IF p_response NOT IN ('Accepted', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid response — must be Accepted or Rejected';
  END IF;

  UPDATE public.price_quotes q
  SET status = p_response,
      accepted_at = CASE WHEN p_response = 'Accepted' THEN now() ELSE q.accepted_at END,
      updated_at = now()
  WHERE q.id = p_quote_id
    AND q.status = 'Sent_To_Customer'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.get_auth_user_company_id()
      AND lower(c.name) = lower(q.customer_name)
    )
  RETURNING q.* INTO v_quote;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'Quote not found, already resolved, or does not belong to your company.';
  END IF;

  IF v_quote.submission_id IS NOT NULL THEN
    UPDATE public.apply_submissions
    SET pricing_status = CASE WHEN p_response = 'Accepted' THEN 'Pricing_Accepted' ELSE 'Pricing_Rejected' END,
        updated_at = now()
    WHERE id = v_quote.submission_id;
  END IF;

  RETURN v_quote;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.respond_to_price_quote_authenticated(uuid, text) TO authenticated;

-- Mirror the same follow-through onto the no-login public status page path,
-- for consistency — a customer responding from /apply/status without an
-- account should get the identical downstream effect as one responding
-- from their logged-in dashboard.
CREATE OR REPLACE FUNCTION public.respond_to_price_quote(
  p_quote_id uuid,
  p_reference_code text,
  p_email text,
  p_response text
)
RETURNS public.price_quotes AS $$
DECLARE
  v_quote public.price_quotes;
BEGIN
  IF p_response NOT IN ('Accepted', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid response — must be Accepted or Rejected';
  END IF;

  SELECT q.* INTO v_quote
  FROM public.price_quotes q
  JOIN public.apply_submissions s ON s.id = q.submission_id
  WHERE q.id = p_quote_id
    AND s.apply_reference_code = upper(trim(p_reference_code))
    AND lower(s.contact_email) = lower(trim(p_email))
    AND q.status = 'Sent_To_Customer';

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'Quote not found, already resolved, or reference/email do not match.';
  END IF;

  UPDATE public.price_quotes
  SET status = p_response,
      accepted_at = CASE WHEN p_response = 'Accepted' THEN now() ELSE accepted_at END,
      updated_at = now()
  WHERE id = p_quote_id
  RETURNING * INTO v_quote;

  UPDATE public.apply_submissions
  SET pricing_status = CASE WHEN p_response = 'Accepted' THEN 'Pricing_Accepted' ELSE 'Pricing_Rejected' END,
      updated_at = now()
  WHERE id = v_quote.submission_id;

  RETURN v_quote;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.respond_to_price_quote(uuid, text, text, text) TO anon, authenticated;
