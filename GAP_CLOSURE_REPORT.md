# Architecture Blueprint Gap Closure Report

**Project:** Forge & Fabric (Apparel Manufacturing ERP/MES)  
**Target Standard:** `ARCHITECTURE_BLUEPRINT.md`  
**Date:** August 11, 2026  

---

## 1. Blueprint Section 1.1 Module Inventory & Migration Status

| Blueprint Module / Route Path | Assigned Stage | Blueprint Section | Final Migration Status | Notes & Implementation Summary |
|---|---|---|---|---|
| `src/routes/signup.tsx` | Auth / Security | 3.1 | **Fully Migrated** | Open registration disabled. Informational RBAC security page directing to admin provisioning. |
| `src/routes/settings.users.tsx` | Admin Settings | 3.2 | **Fully Migrated** | Admin User Management & Invite Modal. Hard-enforces `company_id` selection when `role === 'customer'`. |
| `supabase/functions/invite-user` | Security Edge | 3.3 | **Fully Migrated** | Invites via service role key, enforces hard server-side company validation for customer roles. |
| `src/lib/permissions.ts` | Frontend RBAC | 3.0 | **Fully Migrated** | Single source-of-truth 10-role permission matrix. |
| `src/components/shared/CustomerSelector.tsx` | Order Intake | Flow B | **Fully Migrated** | Searchable `companies` dropdown, pre-filled read-only address/contact preview, state-machine locking. |
| `src/routes/styles.tsx` | PLM Master | Section 6.2 | **Fully Migrated** | Style Master Directory, category badges, size range links, and BOM Recipe Status (Green/Red). |
| `src/routes/styles.$styleId.tsx` | PLM Master | Section 6.2 | **Fully Migrated** | Style specification detail, colorways, and Bulk SKU Variant Generator preview modal. |
| `src/routes/size-ranges.tsx` | PLM Master | Section 6.2 | **Fully Migrated** | Size Ranges Master with interactive Chip / Tag input editor for dynamic size arrays. |
| `src/routes/boms.tsx` | PLM Master | Flow C | **Fully Migrated** | BOM recipe builder with consumption rates, waste allowances, and unit material cost estimations. |
| `src/components/apply-portal/SizeMatrixGrid.tsx` | Order Intake | Gap P3 | **Fully Migrated** | Generic, data-driven size matrix grid for denim (28-40), alpha (XS-XXL), or custom scales. |
| `src/routes/apply.new.tsx` | Public Order Intake | Flow B | **Fully Migrated** | 6-step public intake wizard with customer selector hard gate, generic size matrix, and PO draft submission. |
| `src/routes/apply-intake.tsx` | Internal Direct Intake | Flow B | **Fully Migrated** | Merchandiser direct order intake wizard with inline style creation modal and direct RPC conversion. |
| `src/routes/submissions.$submissionId.tsx` | Merchandiser Review | Flow C | **Fully Migrated** | Merchandiser review screen with "Approve PO" calling `convert_po_to_work_orders` RPC and inline validation alerts. |
| `INVENTORY_UNIFICATION_NOTES.md` | Inventory | Gap P5 | **Fully Migrated** | Audit document explaining legacy divergence and establishing unified schema architecture. |
| `src/routes/inventory.tsx` | Inventory | Section 6.1 | **Fully Migrated** | Single unified inventory hub with dynamic facility filters, GRN material receipt, 4-point inspection grading, and issuances. |
| `src/routes/materials.tsx` | Legacy Inventory | Gap P5 | **Fully Migrated** | Legacy route cleanly redirected to `/inventory` without broken links. |
| `src/routes/cutting.tsx` | MES Cutting | Flow D (1-2) | **Fully Migrated** | Cut Ticket creation with inventory lot availability gate, bundle barcode tag generation, and atomic issuance logs. |
| `src/routes/sewing.tsx` | MES Sewing | Flow D (3) | **Fully Migrated** | Bundle barcode scanner with Pat-Ting friendly large targets, routing operation updates, and scan_events logs. |
| `src/routes/qc.tsx` | MES Quality | Flow D (4) | **Fully Migrated** | QC inspection logging with defect code taxonomy, rework queue routing, and customer privacy shield. |
| `src/routes/dispatch.tsx` | MES Dispatch | Flow D (5) | **Fully Migrated** | Packing lists, address book destination mapping, driver POD signature flow, and status fulfillment cascade. |
| `src/routes/settings.branding.tsx` | White-Label | Section 6.2 | **Fully Migrated** | Admin tenant white-label configuration screen with dynamic CSS custom property injection and live portal preview. |
| `src/contexts/ThemeContext.tsx` | System Core | Section 6.2 | **Fully Migrated** | ThemeProvider injecting `--color-primary`, `--color-secondary`, `--color-accent` into `:root` at boot. |
| `src/routes/reports.tsx` | Analytics | Blueprint | **Fully Migrated** | Executive analytics pulling from unified schema (yield %, defect %, OTIF %) with CSV export and date filters. |
| `src/routes/sku-mapping.tsx` | Customer Master | Blueprint | **Fully Migrated** | External customer SKU to factory SKU mapping screen guarded by `product_master` permissions. |
| `src/routes/update-requests.tsx` | Change Management | Flow E | **Fully Migrated** | Order change request board implementing cutting-started vs not branching for merchandisers. |
| `src/routes/finance.tsx` | Invoicing | Blueprint | **Fully Migrated** | Finance and invoicing dashboard reflecting stage 12/13 dispatch fulfillment statuses. |
| `src/routes/orders.tsx` | Sales Orders | Blueprint | **Fully Migrated** | Active orders dashboard with RBAC action guards and stage progression tracking. |
| `src/routes/orders.$orderId.tsx` | Order Detail | Blueprint | **Fully Migrated** | Detailed order view with stage navigator and permission guards. |
| `src/routes/machines.tsx` | Shop Floor Setup | Supplementary | **Migrated, minor follow-up** | Equipment list UI functional; linked to facility scope. |
| `src/routes/process.tsx` | Shop Floor Setup | Supplementary | **Migrated, minor follow-up** | Manufacturing process documentation view functional. |
| `src/routes/compliance.tsx` | Audit & ESG | Supplementary | **Migrated, minor follow-up** | Factory compliance certifications dashboard functional. |
| `src/routes/sustainability.tsx` | Audit & ESG | Supplementary | **Migrated, minor follow-up** | Environmental impact and water recycling tracking functional. |

---

## 2. Summary of Key Architectural Fixes

1. **Eliminated Hardcoded Denim Sizing (Gap P3)**: Standardized on generic `SizeMatrixGrid` driven dynamically by `size_ranges`.
2. **Unified Inventory Discrepancy (Gap P5)**: Redirected `/materials` to `/inventory`, establishing single source of truth for stock accounting ($\text{Available} = \text{On Hand} - \text{Allocated}$).
3. **Hard State-Machine Locking (Gap P1 & CEO Bug)**: Step 1 of intake wizard hard-locks step progression until customer selection is validly confirmed.
4. **Complete Customer Privacy Shield (Gap P8 & Blueprint Section 6.1)**: QC and tracking interfaces hide internal operator names and machine IDs from customer roles.
5. **Tenant White-Labeling (Blueprint Section 6.2)**: `tenant_config` and `ThemeContext` provide customizable CSS variable injection across all screens.
