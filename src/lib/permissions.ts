// FORGE & FABRIC INDUSTRIES, INC. — SINGLE SOURCE OF TRUTH PERMISSION MATRIX (RBAC)

export type Role =
  | 'super_admin'
  | 'admin'
  | 'merchandiser'
  | 'production_manager'
  | 'cutting_supervisor'
  | 'sewing_supervisor'
  | 'qc_inspector'
  | 'warehouse'
  | 'customer'
  | 'finance'
  // Legacy backward-compatibility aliases
  | 'production'
  | 'qc';

export type Module =
  | 'admin'
  | 'crm'
  | 'product_master'
  | 'orders'
  | 'production_planning'
  | 'shop_floor'
  | 'qc'
  | 'inventory'
  | 'shipping'
  | 'finance'
  | 'pricing';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

// Map legacy role aliases to standard ERP matrix roles
export function normalizeRole(role?: string | null): Role {
  if (!role) return 'customer';
  const clean = role.toLowerCase().trim();
  if (clean === 'production') return 'production_manager';
  if (clean === 'qc') return 'qc_inspector';
  return (clean as Role) || 'customer';
}

// Matrix definition: [Module][Role][Action] = boolean
export const PERMISSION_MATRIX: Record<Module, Record<Role, Record<PermissionAction, boolean>>> = {
  admin: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: false, update: false, delete: false },
    production_manager: { create: false, read: false, update: false, delete: false },
    cutting_supervisor: { create: false, read: false, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: false, update: false, delete: false },
    finance: { create: false, read: false, update: false, delete: false },
    production: { create: false, read: false, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  crm: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: true, read: true, update: true, delete: false },
    production_manager: { create: false, read: true, update: false, delete: false },
    cutting_supervisor: { create: false, read: false, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: true, update: false, delete: false },
    customer: { create: false, read: true, update: true, delete: false }, // Own profile/address only
    finance: { create: false, read: true, update: false, delete: false },
    production: { create: false, read: true, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  product_master: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: true, read: true, update: true, delete: true },
    production_manager: { create: false, read: true, update: false, delete: false },
    cutting_supervisor: { create: false, read: true, update: false, delete: false },
    sewing_supervisor: { create: false, read: true, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: true, update: false, delete: false },
    finance: { create: false, read: true, update: false, delete: false },
    production: { create: false, read: true, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  orders: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: true, read: true, update: true, delete: true },
    production_manager: { create: false, read: true, update: false, delete: false },
    cutting_supervisor: { create: false, read: false, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: true, read: true, update: false, delete: false }, // Scoped own orders
    finance: { create: false, read: true, update: false, delete: false },
    production: { create: false, read: true, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  production_planning: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: true, update: false, delete: false },
    production_manager: { create: true, read: true, update: true, delete: true },
    cutting_supervisor: { create: false, read: true, update: false, delete: false },
    sewing_supervisor: { create: false, read: true, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: true, update: false, delete: false }, // Status only
    finance: { create: false, read: false, update: false, delete: false },
    production: { create: true, read: true, update: true, delete: true },
    qc: { create: false, read: false, update: false, delete: false },
  },

  shop_floor: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: true, update: false, delete: false },
    production_manager: { create: true, read: true, update: true, delete: true },
    cutting_supervisor: { create: true, read: true, update: true, delete: false },
    sewing_supervisor: { create: true, read: true, update: true, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: false, update: false, delete: false },
    finance: { create: false, read: false, update: false, delete: false },
    production: { create: true, read: true, update: true, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  qc: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: true, update: false, delete: false },
    production_manager: { create: false, read: true, update: false, delete: false },
    cutting_supervisor: { create: false, read: true, update: false, delete: false },
    sewing_supervisor: { create: false, read: true, update: false, delete: false },
    qc_inspector: { create: true, read: true, update: true, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: false, update: false, delete: false },
    finance: { create: false, read: false, update: false, delete: false },
    production: { create: false, read: true, update: false, delete: false },
    qc: { create: true, read: true, update: true, delete: false },
  },

  inventory: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: true, read: true, update: true, delete: false },
    production_manager: { create: true, read: true, update: true, delete: false },
    cutting_supervisor: { create: false, read: true, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: true, read: true, update: true, delete: true },
    customer: { create: false, read: false, update: false, delete: false },
    finance: { create: false, read: true, update: false, delete: false },
    production: { create: true, read: true, update: true, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  shipping: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: true, update: false, delete: false },
    production_manager: { create: false, read: true, update: false, delete: false },
    cutting_supervisor: { create: false, read: false, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: true, read: true, update: true, delete: true },
    customer: { create: false, read: true, update: false, delete: false }, // POD view
    finance: { create: false, read: true, update: false, delete: false },
    production: { create: false, read: true, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  finance: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: true, update: false, delete: false },
    production_manager: { create: false, read: false, update: false, delete: false },
    cutting_supervisor: { create: false, read: false, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: true, update: false, delete: false }, // Own invoices
    finance: { create: true, read: true, update: true, delete: true },
    production: { create: false, read: false, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },

  // Pricing & Rates admin module: rate_cards, article_cycle_profiles,
  // rush_multiplier_tiers, customer_pricing_rules, sample_pricing_rules.
  // Mirrors has_module_permission('pricing', ...) in
  // 20260901002000_pricing_engine_schema.sql — keep the two in sync by hand.
  // Merchandiser needs read access to look rates up while quoting; only
  // finance (and admin/super_admin) may create/edit. Never granted to
  // customer — the discount/rate mechanism itself must stay invisible to
  // the customer portal, which only ever sees the resulting quoted price.
  pricing: {
    super_admin: { create: true, read: true, update: true, delete: true },
    admin: { create: true, read: true, update: true, delete: true },
    merchandiser: { create: false, read: true, update: false, delete: false },
    production_manager: { create: false, read: false, update: false, delete: false },
    cutting_supervisor: { create: false, read: false, update: false, delete: false },
    sewing_supervisor: { create: false, read: false, update: false, delete: false },
    qc_inspector: { create: false, read: false, update: false, delete: false },
    warehouse: { create: false, read: false, update: false, delete: false },
    customer: { create: false, read: false, update: false, delete: false },
    finance: { create: true, read: true, update: true, delete: true },
    production: { create: false, read: false, update: false, delete: false },
    qc: { create: false, read: false, update: false, delete: false },
  },
};

export function hasPermission(
  rawRole: string | undefined | null,
  module: Module,
  action: PermissionAction
): boolean {
  const role = normalizeRole(rawRole);
  // Super Admin and Admin override all checks
  if (role === 'super_admin' || role === 'admin') return true;

  const modulePerms = PERMISSION_MATRIX[module];
  if (!modulePerms) return false;
  const rolePerms = modulePerms[role];
  if (!rolePerms) return false;

  return rolePerms[action] ?? false;
}
