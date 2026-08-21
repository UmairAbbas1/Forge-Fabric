-- ==============================================================================
-- Adds a dedicated, customer-safe field for why an application was rejected.
--
-- apply_submissions already stores the rejection reason in internal_notes
-- (format: "[Rejection Reason: <date>] <reason>"), but internal_notes is
-- treated as staff-only everywhere else in this app (see orders.$orderId.tsx)
-- and a merchandiser can append further internal commentary to it after the
-- fact via updateInternalNotes — neither of those should ever reach the
-- customer. A dedicated column keeps the customer-facing reason clean and
-- independent of internal staff notes.
-- ==============================================================================

ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
