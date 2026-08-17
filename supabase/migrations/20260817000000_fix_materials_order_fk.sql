-- Migration: 20260817000000_fix_materials_order_fk.sql
-- Description: Drop rigid foreign key constraint materials_order_id_fkey on public.materials
-- to prevent GRN material receiving failures when PO numbers or intake reference codes are logged.

ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_order_id_fkey;

-- Ensure materials index for fast lookups remains active
CREATE INDEX IF NOT EXISTS idx_materials_order_id ON public.materials(order_id);
