-- The new outsourcing_staff role (see 20260922000000_add_outsourcing_staff_role.sql)
-- was rejected by RLS everywhere: is_internal_staff() and has_module_permission()
-- are the two gate functions almost every table's policies call, and neither
-- knew this role existed, so /outsourcing's order picker came back empty and
-- dispatch/receive/QC-return writes would have failed too.
--
-- is_internal_staff() gates stage_outsourcing_records, outsource_return_qc,
-- and notifications (all used by StageOutsourcingPanel, the shared component
-- this page reuses) — add the role there, same as every other staff role.
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND coalesce(deactivated, false) = false
    AND role::varchar IN (
      'super_admin', 'admin', 'merchandiser', 'production_manager',
      'cutting_supervisor', 'sewing_supervisor', 'qc_inspector',
      'warehouse', 'finance', 'production', 'qc',
      'outsourcing_staff'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- has_module_permission() gates the orders table's SELECT policy — give
-- outsourcing_staff read-only orders access (it needs to list orders to pick
-- one) and mirror src/lib/permissions.ts's production_planning row
-- (read + update, no create/delete) for consistency with the app-level matrix.
CREATE OR REPLACE FUNCTION public.has_module_permission(p_module text, p_action text)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role::varchar INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND coalesce(deactivated, false) = false;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN CASE p_module
    WHEN 'crm' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'warehouse' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'product_master' THEN CASE v_role
      WHEN 'merchandiser' THEN TRUE
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'orders' THEN CASE v_role
      WHEN 'merchandiser' THEN TRUE
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      WHEN 'outsourcing_staff' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'production_planning' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN TRUE
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'production' THEN TRUE
      WHEN 'outsourcing_staff' THEN p_action IN ('read', 'update')
      ELSE FALSE
    END
    WHEN 'shop_floor' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN TRUE
      WHEN 'cutting_supervisor' THEN p_action IN ('create', 'read', 'update')
      WHEN 'sewing_supervisor' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'qc' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'sewing_supervisor' THEN p_action = 'read'
      WHEN 'qc_inspector' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production' THEN p_action = 'read'
      WHEN 'qc' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'inventory' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action IN ('create', 'read', 'update')
      WHEN 'production_manager' THEN p_action IN ('create', 'read', 'update')
      WHEN 'cutting_supervisor' THEN p_action = 'read'
      WHEN 'warehouse' THEN TRUE
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action IN ('create', 'read', 'update')
      ELSE FALSE
    END
    WHEN 'shipping' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'production_manager' THEN p_action = 'read'
      WHEN 'warehouse' THEN TRUE
      WHEN 'finance' THEN p_action = 'read'
      WHEN 'production' THEN p_action = 'read'
      ELSE FALSE
    END
    WHEN 'finance' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'finance' THEN TRUE
      ELSE FALSE
    END
    WHEN 'pricing' THEN CASE v_role
      WHEN 'merchandiser' THEN p_action = 'read'
      WHEN 'finance' THEN TRUE
      ELSE FALSE
    END
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
