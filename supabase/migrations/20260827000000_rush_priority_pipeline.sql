-- ==============================================================================
-- FORGE & FABRIC — RUSH PRIORITY: SETTINGS, INTAKE PERSISTENCE, ORDER CARRY-FORWARD
-- Migration: 20260827000000_rush_priority_pipeline.sql
--
-- Rush was previously a hardcoded 2.0x multiplier baked into ReviewSummary.tsx
-- and flattened into a free-text client_notes substring at intake — never a
-- real column anywhere, never admin-configurable, never carried into orders.
-- This adds the three real columns the rest of the codebase needs:
--   tenant_config.rush_multiplier / rush_lead_time_reduction_days — admin config
--   apply_submissions.priority / rush_multiplier — real intake selection
--   orders.priority / rush_multiplier — carried forward at conversion, read by
--     the Kanban badge and the pricing/delivery-date logic
-- Idempotent throughout.
-- ==============================================================================

ALTER TABLE IF EXISTS public.tenant_config
  ADD COLUMN IF NOT EXISTS rush_multiplier numeric NOT NULL DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS rush_lead_time_reduction_days int NOT NULL DEFAULT 7;

ALTER TABLE IF EXISTS public.apply_submissions
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Normal'
    CHECK (priority IN ('Normal', 'Rush')),
  ADD COLUMN IF NOT EXISTS rush_multiplier numeric;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Normal'
    CHECK (priority IN ('Normal', 'Rush')),
  ADD COLUMN IF NOT EXISTS rush_multiplier numeric;
