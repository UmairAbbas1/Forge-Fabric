-- ==============================================================================
-- FORGE & FABRIC — SAMPLE REQUEST GARMENT-DEFINITION DETAIL (item 5)
-- Migration: 20260829000000_sample_request_garment_detail.sql
--
-- Sample Request previously captured nothing beyond sample_type/fabric_trim_source
-- and a bare size grid — no style name, colorway, or real fabric material
-- selector like the Bulk flow's StyleBlockEditor already has. This adds the
-- real columns for that detail on sample_requests (the table real sample
-- data actually lives in), matching the Woven/Knit/Other + custom pattern
-- already established on apply_submissions.style_blocks for Bulk orders.
-- Idempotent.
-- ==============================================================================

ALTER TABLE IF EXISTS public.sample_requests
  ADD COLUMN IF NOT EXISTS style_name text,
  ADD COLUMN IF NOT EXISTS style_description text,
  ADD COLUMN IF NOT EXISTS colorway text,
  ADD COLUMN IF NOT EXISTS fabric_type text,
  ADD COLUMN IF NOT EXISTS custom_fabric_type text;
