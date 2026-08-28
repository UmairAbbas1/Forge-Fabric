-- ============================================================================
-- Extends the previous realtime-enablement migration
-- (20260901000600_enable_realtime_and_fix_conversion_integrity.sql) to cover
-- the actual production-pipeline tables it missed: cut_tickets and
-- sewing_tickets (the literal "Cutting Ticket" / "Sewing Ticket" tables),
-- plus the supporting bundle/inventory/rework tables that feed them.
--
-- Root cause confirmed the same way as before: cutting.tsx and sewing.tsx
-- had ZERO client-side realtime subscription code at all (unlike
-- apply_submissions/orders/qc.tsx, which at least had listener code that
-- was silently dead pre-migration), so a new Cutting or Sewing ticket
-- never reached QC, Admin, or any other dependent screen without a manual
-- refresh. Client-side subscriptions were added directly to cutting.tsx,
-- sewing.tsx, and the central useAppData.tsx db-realtime channel (which
-- qc.tsx's cutTickets/sewingTickets/materials data flows through) in the
-- same change as this migration — this migration is the DB-side half of
-- that fix; without it, those new listeners still receive nothing.
-- ============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cut_tickets',
    'sewing_tickets',
    'bundles',
    'sewing_bundles',
    'cutting_records',
    'inventory_lots',
    'inventory_issuances',
    'inventory_items',
    'rework_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;
