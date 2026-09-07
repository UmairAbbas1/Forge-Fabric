-- ==============================================================================
-- FIX: a merchandiser could convert an application straight to a real
-- production order (apply_submissions.status -> 'converted') with ZERO
-- pricing gate — the Issue Price Quote / customer-approval workflow already
-- existed (price_quotes, pricing_status, respond_to_price_quote_authenticated
-- in 20260901001100) and its own code comment documented the intended rule
-- ("Accepted tells the merchandiser they can convert to a Work Order"), but
-- nothing ever actually enforced it. The "Approve PO & Convert to Work
-- Orders" button in SubmissionDetailPanel.tsx rendered unconditionally, so a
-- merchandiser could click Convert before ever issuing a quote (pricing_status
-- defaults to 'Not_Required' — genuinely just means "no quote issued yet"),
-- while a quote was still pending customer response, or even after the
-- customer explicitly rejected it.
--
-- This trigger is the server-side half of the fix (the client-side half
-- hides/disables the Convert button in SubmissionDetailPanel.tsx) — defense
-- in depth so the rule holds regardless of which code path performs the
-- write: the direct client-side fallback UPDATE in useConvertSubmission.ts,
-- or the convert-submission-to-po Edge Function.
--
-- Order-update / revision submissions never reach status = 'converted' at
-- all (they go through a separate "Approve Revision" flow that only ever
-- sets status = 'approved'), so this gate never affects them.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_pricing_approval_before_conversion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
    IF NEW.pricing_status IS DISTINCT FROM 'Pricing_Accepted' THEN
      RAISE EXCEPTION 'Cannot convert this submission to a production order until the customer has accepted a price quote. Current pricing_status: %', COALESCE(NEW.pricing_status, 'null')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_pricing_approval_before_conversion ON public.apply_submissions;
CREATE TRIGGER trg_enforce_pricing_approval_before_conversion
BEFORE UPDATE ON public.apply_submissions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pricing_approval_before_conversion();
