# Forge & Fabric — Industrial Apparel Manufacturing ERP/MES

Forge & Fabric is an industrial-grade enterprise ERP/MES built specifically for garment and apparel manufacturing facilities (jeans, knitwear, woven tops, activewear). Designed following the architecture standard defined in [`ARCHITECTURE_BLUEPRINT.md`](./ARCHITECTURE_BLUEPRINT.md).

---

## 13-Stage Manufacturing Production Pipeline

Forge & Fabric preserves and tracks garments across the complete 13-stage industrial manufacturing pipeline:

1. **Stage 01: Customer Order Intake** — Sales PO header creation, tech pack attachment, and size breakdown matrix entry.
2. **Stage 02: Raw Material Receiving** — Vendor Goods Receipt Note (GRN) logging into unified inventory.
3. **Stage 03: Fabric & Trim Inspection** — 4-Point fabric inspection scoring and material quality hold/approval.
4. **Stage 04: Pre-Production Planning** — Production scheduling, BOM recipe validation, and line allocation.
5. **Stage 05: Pattern / Marker / Cutting** — Marker spreading, plies layering, and Cut Ticket execution.
6. **Stage 06: Bundling & Line Feeding** — Automatic barcode bundle tag generation (`BND-XXXXX`) and shade lot sorting.
7. **Stage 07: Sewing Production** — Line operation barcode scanning (`scan_events`) and WIP tracking across workstations.
8. **Stage 08: Pre-Wash QC** — Inline sewing quality inspection and seam integrity validation.
9. **Stage 09: Laundry / Wash / Dry** — Industrial washing, stonewash, enzyme baths, and drying operations.
10. **Stage 10: Laser / Ozone / Spray / 3D Finish** — Jeanologia laser distressing, ozone fading, spray booth, and 3D whiskering.
11. **Stage 11: Final Quality Inspection** — AQL 2.5 final garment audit and Rework Queue routing.
12. **Stage 12: Pressing / Tagging / Packing** — Steam pressing, hangtag attachment, and carton packing lists (`packing_lists`).
13. **Stage 13: Finished Goods Dispatch** — Address book destination linkage, driver POD signature, and PO fulfillment cascade.

---

## Technical Architecture & Technology Stack

*   **Frontend Core:** React 19 + TypeScript + Vite + TanStack Router & TanStack Query.
*   **Database & Security:** Supabase PostgreSQL with 8 enterprise migrations, Row Level Security (RLS) policies, and Deno Edge Functions.
*   **Styling & White-Labeling:** Vanilla Tailwind CSS with custom CSS variable theme injection (`ThemeProvider`) for multi-tenant white-label sellability.

---

## Core Features & Blueprint Workflows

1. **Enterprise RBAC & User Management (`/settings/users`):**
   * 10 granular blueprint roles (`super_admin`, `admin`, `merchandiser`, `production_manager`, `cutting_supervisor`, `sewing_supervisor`, `qc_inspector`, `warehouse`, `customer`, `finance`).
   * Customer account invite flow strictly linked to validated CRM `companies`.

2. **PLM & Product Master (`/styles`, `/size-ranges`, `/boms`):**
   * **Size Ranges Master:** Chip/tag editor for dynamic numeric, alpha, kids, or custom size arrays.
   * **Style Master & Bulk SKU Generator:** Style code directory with colorway management and automated $\text{Style} \times \text{Colorway} \times \text{Size}$ SKU generation.
   * **BOM Recipe Builder:** Raw material consumption rates, waste allowances, and unit garment material costing.

3. **Generic Order Intake (Flow B - `/apply/new` & `/apply-intake`):**
   * Hard-gated Customer Selection preventing unverified brand creation.
   * Generic `SizeMatrixGrid` driven dynamically by style size ranges (no hardcoded jeans sizes).
   * Direct PO-to-Work Order RPC conversion (`convert_po_to_work_orders`).

4. **Shop Floor MES Execution (Flow D - `/inventory`, `/cutting`, `/sewing`, `/qc`, `/dispatch`):**
   * **Unified Inventory Hub:** Single source-of-truth inventory for fabric lots, trim stock, GRN vendor receipts, 4-point inspection grading, and atomic issuance logs ($\text{Available} = \text{On Hand} - \text{Allocated}$).
   * **Cutting Spreading:** Inventory lot availability validation gate, Cut Ticket execution, and auto-generated barcode bundle tags (`BND-XXXXX`).
   * **Sewing Line Tracking:** Sequential operation barcode scanner with Pat-Ting friendly large touch targets and `scan_events` logging.
   * **Unified QC & Rework:** Defect taxonomy logging (`Stitching`, `Fabric`, `Wash`, `Trim`), Rework Queue routing, and Customer Privacy Shield (operator names kept private).
   * **Dispatch Logistics:** Export packing lists, customer `address_book` destination linkage, driver POD signatures, and automatic status fulfillment cascade.

5. **Tenant White-Labeling & Branding (`/settings/branding`):**
   * Dynamic custom CSS variable theme injection (`--color-primary`, `--color-secondary`, `--color-accent`) into `:root` at boot for full tenant customization.

---

## Database Migration Run Sequence

To execute migrations against a local or remote Supabase instance, run in order per [`MIGRATION_RUNBOOK.md`](./MIGRATION_RUNBOOK.md):

```bash
# Push database migrations to remote Supabase
npx supabase db push
```

Migration Suite Sequence:
1. `20260811000100_erp_core_master_entities.sql`
2. `20260811000200_erp_sales_planning_and_wos.sql`
3. `20260811000300_erp_mes_shop_floor_and_qc.sql`
4. `20260811000400_erp_inventory_and_lots.sql`
5. `20260811000500_erp_data_migration_backfill.sql`
6. `20260811000600_erp_rls_security_policies.sql`
7. `20260811000700_erp_convert_po_function.sql`
8. `20260811000800_erp_tenant_branding.sql`

---

## Quality Assurance & Testing

Refer to [`SMOKE_TEST_CHECKLIST.md`](./SMOKE_TEST_CHECKLIST.md) for step-by-step manual QA verification of the end-to-end golden path.
