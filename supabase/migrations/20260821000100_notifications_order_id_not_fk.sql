-- ==============================================================================
-- Root cause of "rejection notification never reaches the customer": the
-- notifications table's order_id column carries a hard foreign key to
-- orders.order_id. A rejected apply_submissions application has no backing
-- orders row (it never got converted), so any attempt to notify the
-- customer using their application's own reference code as order_id was
-- being rejected outright by Postgres with a foreign-key violation — the
-- insert never happened, not silently, but not visibly either since the
-- calling code only console.warn'd on failure.
--
-- order_id on this table has always been used loosely elsewhere in the app
-- as "the thing this notification is about" (see handleNotifClick in
-- AppShell.tsx navigating to /orders/$orderId, which — since an earlier fix
-- today — already resolves either a real order OR a not-yet-converted
-- submission by reference code). The strict FK no longer matches how the
-- column is actually used, so it's the constraint that's wrong, not the
-- calling code.
-- ==============================================================================

ALTER TABLE IF EXISTS public.notifications
  DROP CONSTRAINT IF EXISTS notifications_order_id_fkey;
