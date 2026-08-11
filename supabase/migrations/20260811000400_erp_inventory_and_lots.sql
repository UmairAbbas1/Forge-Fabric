-- ==============================================================================
-- FORGE & FABRIC — MIGRATION 4: INVENTORY UNIFICATION & LOT MANAGEMENT
-- Migration: 20260811000400_erp_inventory_and_lots.sql
-- ==============================================================================

-- 1. EXTEND INVENTORY ITEMS MASTER
ALTER TABLE public.inventory_items
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS minimum_reorder_level NUMERIC(10,2) DEFAULT 100.00;

-- 2. INVENTORY LOTS (Transactional Stock Batches)
CREATE TABLE IF NOT EXISTS public.inventory_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    facility_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    lot_number VARCHAR(100) NOT NULL,
    quantity_on_hand NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (quantity_on_hand >= 0),
    allocated_qty NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (allocated_qty >= 0),
    available_qty NUMERIC(12,2) GENERATED ALWAYS AS (quantity_on_hand - allocated_qty) STORED,
    location_bin VARCHAR(100) DEFAULT 'Main Warehouse Bin A1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_inventory_item_lot_facility UNIQUE(item_id, lot_number, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_item ON public.inventory_lots(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_facility ON public.inventory_lots(facility_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_number ON public.inventory_lots(lot_number);

-- Timestamps trigger
DROP TRIGGER IF EXISTS trg_inventory_lots_updated_at ON public.inventory_lots;
CREATE TRIGGER trg_inventory_lots_updated_at BEFORE UPDATE ON public.inventory_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
