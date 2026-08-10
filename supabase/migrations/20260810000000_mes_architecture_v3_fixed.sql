-- ==============================================================================
-- FORGE & FABRIC — MES & INVENTORY ARCHITECTURE (V3 FIXED)
-- ==============================================================================

-- 1. Extend Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facility VARCHAR(30) 
  CHECK (facility IN ('Sewing Facility', 'Laundry Facility', 'Both', NULL));

-- 2. Extend Existing Core Tables
ALTER TABLE public.blanket_pos ADD COLUMN IF NOT EXISTS po_subtype VARCHAR(20) DEFAULT 'Blanket';
ALTER TABLE public.blanket_pos ADD COLUMN IF NOT EXISTS auto_close_on_fulfill BOOLEAN DEFAULT FALSE;
ALTER TABLE public.blanket_pos ADD COLUMN IF NOT EXISTS open_balance DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS starting_stage_id INT DEFAULT 1;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS flavor_route VARCHAR(50);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS assigned_facility VARCHAR(30);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS materials_issued BOOLEAN DEFAULT FALSE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS ready_for_invoice BOOLEAN DEFAULT FALSE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- 3. Backfill Data
UPDATE public.blanket_pos SET po_subtype = 'Blanket' WHERE po_subtype IS NULL;
UPDATE public.work_orders SET starting_stage_id = 1 WHERE starting_stage_id IS NULL;


-- 5. Open Balance Trigger (FIXED: Handles DELETE + PO changes)
CREATE OR REPLACE FUNCTION public.update_po_open_balance() RETURNS TRIGGER AS $$
DECLARE
  v_old_po_id UUID;
  v_new_po_id UUID;
BEGIN
  v_old_po_id := OLD.blanket_po_id;
  v_new_po_id := NEW.blanket_po_id;

  IF TG_OP = 'DELETE' THEN
    v_new_po_id := NULL;
  END IF;

  -- Update old PO if different
  IF TG_OP IN ('UPDATE', 'DELETE') AND v_old_po_id IS DISTINCT FROM v_new_po_id THEN
    UPDATE public.blanket_pos 
    SET open_balance = GREATEST(0, total_contract_qty - (
      SELECT COALESCE(SUM(target_qty), 0) 
      FROM public.work_orders 
      WHERE blanket_po_id = v_old_po_id
    ))
    WHERE id = v_old_po_id;
  END IF;

  -- Update new PO
  IF v_new_po_id IS NOT NULL THEN
    UPDATE public.blanket_pos 
    SET open_balance = GREATEST(0, total_contract_qty - (
      SELECT COALESCE(SUM(target_qty), 0) 
      FROM public.work_orders 
      WHERE blanket_po_id = v_new_po_id
    ))
    WHERE id = v_new_po_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_open_balance ON public.work_orders;
CREATE TRIGGER trigger_update_open_balance 
AFTER INSERT OR UPDATE OR DELETE ON public.work_orders 
FOR EACH ROW EXECUTE FUNCTION public.update_po_open_balance();

-- 6. SKU Mappings
CREATE TABLE IF NOT EXISTS public.sku_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_code VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES public.profiles(id),
  customer_sku VARCHAR(100) NOT NULL,
  brand_name VARCHAR(100),
  style_name VARCHAR(100),
  colorway VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(factory_code, customer_id)
);
ALTER TABLE public.sku_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and Merchandisers can manage SKU mappings" ON public.sku_mappings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'merchandiser'))
);
CREATE POLICY "Customers can view their own SKU mappings" ON public.sku_mappings FOR SELECT USING (
  customer_id = auth.uid()
);

-- 7. BOM Templates
CREATE TABLE IF NOT EXISTS public.bom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_code VARCHAR(100) NOT NULL,
  style_name VARCHAR(100),
  colorway VARCHAR(50),
  material_category VARCHAR(30) NOT NULL,
  material_name VARCHAR(200) NOT NULL,
  qty_per_unit DECIMAL(10,4) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  facility VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bom_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and Merchandisers can manage BOMs" ON public.bom_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'merchandiser'))
);

-- 8. Material Requisitions
CREATE TABLE IF NOT EXISTS public.material_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
  material_category VARCHAR(30) NOT NULL,
  material_name VARCHAR(200) NOT NULL,
  qty_required DECIMAL(10,2) NOT NULL,
  qty_issued DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  facility VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal Staff can manage Requisitions" ON public.material_requisitions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'merchandiser', 'production'))
);

-- 9. Inventory Issuances
CREATE TABLE IF NOT EXISTS public.inventory_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id),
  inventory_item_id UUID,
  material_requisition_id UUID REFERENCES public.material_requisitions(id),
  qty_issued DECIMAL(10,2) NOT NULL,
  issued_by UUID REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  from_location VARCHAR(30) DEFAULT 'Warehouse',
  to_location VARCHAR(30) DEFAULT 'Production Floor'
);
ALTER TABLE public.inventory_issuances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal Staff can manage Issuances" ON public.inventory_issuances FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'merchandiser', 'production'))
);

-- 10. Auto-Update materials_issued Trigger (NEW)
CREATE OR REPLACE FUNCTION public.auto_update_materials_issued() RETURNS TRIGGER AS $$
DECLARE
  v_wo_id UUID;
  v_required DECIMAL;
  v_issued DECIMAL;
BEGIN
  v_wo_id := NEW.work_order_id;

  SELECT COALESCE(SUM(qty_required), 0) INTO v_required 
  FROM public.material_requisitions WHERE work_order_id = v_wo_id;

  SELECT COALESCE(SUM(qty_issued), 0) INTO v_issued 
  FROM public.inventory_issuances WHERE work_order_id = v_wo_id;

  IF v_required > 0 AND v_issued >= v_required THEN
    UPDATE public.work_orders 
    SET materials_issued = TRUE 
    WHERE id = v_wo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_materials_issued ON public.inventory_issuances;
CREATE TRIGGER trigger_auto_materials_issued 
AFTER INSERT OR UPDATE ON public.inventory_issuances 
FOR EACH ROW EXECUTE FUNCTION public.auto_update_materials_issued();

-- 11. Check Materials Issued Function
CREATE OR REPLACE FUNCTION public.check_materials_issued(p_wo_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_required DECIMAL;
  v_issued DECIMAL;
BEGIN
  SELECT COALESCE(SUM(qty_required), 0) INTO v_required 
  FROM public.material_requisitions WHERE work_order_id = p_wo_id;

  SELECT COALESCE(SUM(qty_issued), 0) INTO v_issued 
  FROM public.inventory_issuances WHERE work_order_id = p_wo_id;

  RETURN v_issued >= v_required AND v_required > 0;
END;
$$ LANGUAGE plpgsql;

-- 12. Invoicing Records
CREATE TABLE IF NOT EXISTS public.invoicing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id),
  blanket_po_id UUID REFERENCES public.blanket_pos(id),
  invoice_number VARCHAR(50) UNIQUE,
  qty_invoiced INT NOT NULL,
  amount DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'Ready',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);
ALTER TABLE public.invoicing_records ENABLE ROW LEVEL SECURITY;
-- TODO: Change 'merchandiser' to 'finance' role when finance team is added
CREATE POLICY "Admins and Finance can manage Invoices" ON public.invoicing_records FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'merchandiser'))
);
CREATE POLICY "Customers can view their Invoices via PO link" ON public.invoicing_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.blanket_pos WHERE id = invoicing_records.blanket_po_id AND customer_id = auth.uid())
);

-- 13. RPC: Generate Material Requisitions (FIXED)
CREATE OR REPLACE FUNCTION public.generate_material_requisitions(p_work_order_id UUID) 
RETURNS INT AS $$
DECLARE
  v_wo_qty INT;
  v_style_name VARCHAR;
  v_colorway VARCHAR;
  v_count INT;
BEGIN
  SELECT target_qty, style_name, colorway 
  INTO v_wo_qty, v_style_name, v_colorway
  FROM public.work_orders 
  WHERE id = p_work_order_id;

  IF v_wo_qty IS NULL THEN
    RAISE EXCEPTION 'Work order % not found', p_work_order_id;
  END IF;

  IF v_style_name IS NULL THEN
    RAISE EXCEPTION 'Work order % is missing style_name', p_work_order_id;
  END IF;

  SELECT COUNT(*) INTO v_count 
  FROM public.material_requisitions 
  WHERE work_order_id = p_work_order_id;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Requisitions already exist for work order %', p_work_order_id;
  END IF;

  INSERT INTO public.material_requisitions (
    work_order_id, material_category, material_name, 
    qty_required, qty_issued, unit, facility, status
  )
  SELECT 
    p_work_order_id,
    bt.material_category,
    bt.material_name,
    ROUND(bt.qty_per_unit * v_wo_qty, 2),
    0,
    bt.unit,
    bt.facility,
    'Pending'
  FROM public.bom_templates bt
  WHERE bt.style_name = v_style_name 
  AND (
    bt.colorway = v_colorway 
    OR bt.colorway IS NULL 
    OR bt.colorway = 'All'
    OR v_colorway IS NULL
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE WARNING 'No BOM templates found for style: %, colorway: %', v_style_name, v_colorway;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 14. REMEDIATION: Inventory Deduction Trigger (B.2 Audit)
CREATE OR REPLACE FUNCTION public.trigger_deduct_inventory_on_issuance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE public.inventory_items
    SET quantity_on_hand = quantity_on_hand - NEW.qty_issued
    WHERE id = NEW.inventory_item_id;
  END IF;

  IF NEW.material_requisition_id IS NOT NULL THEN
    UPDATE public.material_requisitions
    SET qty_issued = qty_issued + NEW.qty_issued
    WHERE id = NEW.material_requisition_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON public.inventory_issuances;
CREATE TRIGGER trg_deduct_inventory
AFTER INSERT ON public.inventory_issuances
FOR EACH ROW EXECUTE FUNCTION public.trigger_deduct_inventory_on_issuance();

-- 15. REMEDIATION: Auto-Grocery List Trigger (B.1 Audit)
CREATE OR REPLACE FUNCTION public.trigger_generate_grocery_list() RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.generate_material_requisitions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_grocery_list ON public.work_orders;
CREATE TRIGGER trg_auto_grocery_list
AFTER INSERT ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_grocery_list();

-- 16. REMEDIATION: Hard-Stop Validation Trigger (F.1 Audit)
CREATE OR REPLACE FUNCTION public.trigger_enforce_hard_stop() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stage > 1 AND OLD.current_stage <= 1 THEN
    IF NOT NEW.materials_issued THEN
      IF NOT public.check_materials_issued(NEW.id) THEN
        RAISE EXCEPTION 'HARD STOP: Cannot release Work Order % to production until raw materials are fully issued.', NEW.id;
      ELSE
        NEW.materials_issued := TRUE;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_hard_stop ON public.work_orders;
CREATE TRIGGER trg_enforce_hard_stop
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_enforce_hard_stop();

-- 17. Indexes for Performance (Moved to end after tables are created)
CREATE INDEX IF NOT EXISTS idx_work_orders_blanket_po_target ON public.work_orders(blanket_po_id, target_qty);
CREATE INDEX IF NOT EXISTS idx_bom_templates_style ON public.bom_templates(style_name, colorway);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_wo ON public.material_requisitions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_issuances_wo ON public.inventory_issuances(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_materials_issued ON public.work_orders(materials_issued, assigned_facility);
CREATE INDEX IF NOT EXISTS idx_work_orders_ready_invoice ON public.work_orders(ready_for_invoice, status);
CREATE INDEX IF NOT EXISTS idx_blanket_pos_customer ON public.blanket_pos(customer_id);
