# Forge & Fabric: Apparel ERP Architecture Blueprint

This document outlines the target generic architecture for the **Forge & Fabric** apparel manufacturing ERP/MES, resolving the hardcoded "jeans-specific" demo flaws and establishing a robust, scalable, industry-standard data model.

---

## SECTION 1: Full Repository Inventory

### 1.1 Complete Route Inventory (`src/routes`)
Total Routes: 38 files
*   `__root.tsx`: Root layout, router context, notification toasts, navigation context.
*   `index.tsx`: Public landing / splash page.
*   `login.tsx`: Authentication login page.
*   `signup.tsx`: Public self-registration (Flaw: open registration).
*   `dashboard.tsx`: Main executive/operations analytics dashboard.
*   `orders.tsx`: Order list, search, status filters, and creation modal.
*   `orders.$orderId.tsx`: Granular order detail, stage progress tracker, cut sheet view.
*   `apply.index.tsx`: Public client self-service portal landing page.
*   `apply.new.tsx`: 5-step client intake wizard container.
*   `apply.status.$referenceCode.tsx`: Client public order status lookup by reference code.
*   `apply.thank-you.tsx`: Intake submission confirmation page.
*   `apply.update.tsx`: Client change request submission route.
*   `apply-intake.tsx`: Internal merchandiser direct order intake wizard.
*   `submissions.tsx`: Merchandiser review inbox for client submissions.
*   `submissions.$submissionId.tsx`: Detailed submission review and conversion action page.
*   `submissions.$submissionId.cut-sheet.tsx`: Interactive cut sheet editor for submissions.
*   `materials.tsx`: Dual-facility raw material receipts and intake log page.
*   `cutting.tsx`: Cut room tracking, layer plans, and first-cut approval status.
*   `sewing.tsx`: Sewing line tracking and bundle inline QC.
*   `wash.tsx`: Laundry facility batch tracking (Wash, Dry, Finish).
*   `qc.tsx`: Defect logging, RCA reports, and AQL checkpoint management.
*   `dispatch.tsx`: Packing list, carton allocation, and POD manifest generation.
*   `inventory.tsx`: Multi-location raw materials & WIP finished goods inventory dashboard.
*   `sku-mapping.tsx`: Customer SKU to factory style code mapping table.
*   `update-requests.tsx`: Merchandiser inbox for client change requests.
*   `reports.tsx`: Analytics, yield, defect rates, and throughput reporting.
*   `settings.tsx`: Admin control panel (users, customers, equipment, size ratios, AQL).
*   `account.tsx`: Profile settings and password management.
*   `machines.tsx`: Equipment utilization and maintenance status.
*   `shop-floor.tsx`: Simplified operator barcode scanning interface.
*   `finance.tsx`: Billing, invoicing records, and PO balance tracking.
*   `process.tsx`: Factory process routing flow diagram.
*   `compliance.tsx`: Sustainability and factory audit certification checklist.
*   `sustainability.tsx`: Water, energy, and chemical eco-impact tracker.
*   `about.tsx`: Public company background page.
*   `contact.tsx`: Public inquiry page.
*   `privacy.tsx`: Public privacy policy.
*   `terms.tsx`: Public terms of service.

### 1.2 Database Schema Inventory (Supabase Postgres Tables)
Total Tables: 31 tables across 22 SQL migrations
*   `profiles`: Auth user metadata (role, email, customer_id, facility).
*   `customers`: Customer company master (name, created_at).
*   `orders`: Legacy order table (order_id, customer_name, PO_number, tech_pack_ref, size_breakdown, status, current_stage, qty).
*   `materials`: Legacy material receipts table.
*   `cutting_records`: Cut room panel logs.
*   `sewing_bundles`: Sewing line bundle logs.
*   `wash_batches`: Laundry batch logs.
*   `qc_records`: QC stage checkpoint results.
*   `cartons`: Dispatch carton records.
*   `blanket_pos`: Parent contract purchase orders.
*   `work_orders`: Child manufacturing execution orders.
*   `apply_submissions`: Public client intake forms.
*   `apply_cut_sheets`: Cut sheet JSON grid data attached to submissions.
*   `update_requests`: Client change requests.
*   `apply_documents`: Tech packs and spec attachments.
*   `merchandiser_assignments`: Merchandiser-to-submission mapping.
*   `notification_logs`: System notification log.
*   `size_gate_records`: 5-gate size breakdown tracker.
*   `bundles`: QR-coded bundle tracking units.
*   `scan_events`: Scan-by-exception event log.
*   `qc_defect_logs`: Defect logs with root-cause analysis.
*   `inventory_items`: Dual-facility inventory items master.
*   `order_documents`: Revision-controlled order document vault.
*   `delivery_manifests`: Shipping manifests with driver signature.
*   `stage_jump_logs`: Audit trail for out-of-sequence stage transitions.
*   `raw_materials_intake`: Raw material intake logs (RMI-YYYY-XXXX).
*   `sku_mappings`: External customer SKU to factory code cross-reference.
*   `bom_templates`: Style BOM recipes.
*   `material_requisitions`: WO material requirement lists.
*   `inventory_issuances`: Inventory issuance audit logs.
*   `invoicing_records`: Financial invoices.

### 1.3 Custom Hooks Inventory (`src/hooks`)
*   `useAppData.tsx`: Global application state wrapper (orders, customers, materials, equipment).
*   `useAuth.tsx`: Supabase authentication session, login, signup, and profile context.
*   `useApplySubmission.ts`: Hooks for submitting client intake applications.
*   `useRawMaterialsIntake.ts`: Hooks for managing raw material intakes and status updates.
*   `useStageJumpLogs.ts`: Audit logger for stage jump events.
*   `useConvertSubmission.ts`: Stored procedure caller for converting submissions to Blanket POs.
*   `useCutSheetParser.ts`: Excel cut sheet spreadsheet parser and JSON generator.
*   `useApplyDraft.ts`: LocalStorage draft recovery for the intake wizard.
*   `use-mobile.tsx`: Responsive mobile viewport detection.
*   `merchandiser/useSubmissions.ts`: Merchandiser submission query and management hook.

### 1.4 Component Architecture Inventory (`src/components`)
*   `AppShell.tsx`: Navigation sidebar, header, top bar, KPI tiles, section cards.
*   `PublicLayout.tsx`: Header and footer for client-facing unauthenticated routes.
*   `apply-portal/`: Client intake wizard components (24 files: `ApplyLayout`, `CompanyInfoForm`, `OrderDetailsForm`, `CutSheetEditor`, `DocumentUploader`, `ReviewSummary`, `SizeMatrixGrid`, `SpreadsheetGrid`, `StatusTracker`, `UpdateRequestForm`, `DraftRecoveryModal`, etc.).
*   `cutting/`: `CutSheetEditor`.
*   `materials/`: `FacilityInventoryWidget`, `RawMaterialsForm`, `RawMaterialsList`.
*   `merchandiser/`: Merchandiser inbox review widgets.
*   `mes/`: `FlavorSelector`, `WoSplitterModal`.
*   `stage/`: Production stage transition cards.
*   `ui/`: Modular UI elements (buttons, inputs, dialogs, badges).

---

## SECTION 2: Full Generic Entity-Relationship Model

The system shifts from text strings and isolated tables to an industry-standard PLM/ERP/MES relational data model.

```
[Company Master] ──1:N──> [Address Book]
       │
       ├──1:N──> [Contact Book]
       │
       ├──1:N──> [User Profile]
       │
       └──1:N──> [Customer PO] ──1:N──> [PO Line Item] ──1:N──> [Work Order]
                                                │                       │
[Size Range Master] ──1:N──> [Style Master] ──1:N─┤                       ├──1:N──> [Cutting Ticket] ──1:N──> [Bundle]
                                    │           │                       │                                     │
                                    └──1:N──> [SKU Master]              └──1:N──> [Material Requisition]      └──1:N──> [QC Inspection]
                                                │                                       │                                  │
                                                └── (SKU Ref in Carton)                 └──> (Deducts Inventory Lot)       └──> [Packing Carton]
```

### 2.1 Entities & Relational Schema
1.  **Company Master (`companies`)**: `id`, `name`, `code`, `tax_id`, `company_type` ('Customer', 'Vendor', 'Internal_Factory'), `status`.
2.  **Address Book (`address_book`)**: `id`, `company_id`, `address_type` ('Shipping', 'Billing', 'HQ'), `street_1`, `street_2`, `city`, `state`, `postal_code`, `country`, `is_primary`.
3.  **Contact Book (`contacts`)**: `id`, `company_id`, `first_name`, `last_name`, `email`, `phone`, `job_title`, `is_primary_contact`.
4.  **User Profile (`profiles`)**: `id` (FK to `auth.users`), `email`, `role`, `company_id` (FK to `companies` for external users), `facility`, `status`.
5.  **Size Range Master (`size_ranges`)**: `id`, `name` (e.g., 'Adult Jeans Numeric', 'T-Shirt Alpha', 'Kids Age'), `sizes` (JSON array: `["XS", "S", "M", "L", "XL"]` or `["28", "30", "32", "34", "36"]`).
6.  **Style Master (`styles`)**: `id`, `style_code`, `style_name`, `category` ('Denim', 'Knitwear', 'Outerwear', 'Woven Shirt'), `size_range_id` (FK to `size_ranges`), `description`, `tech_pack_url`.
7.  **SKU Master (`skus`)**: `id`, `style_id` (FK to `styles`), `colorway`, `size_code`, `sku_code` (Generated: `STYLE-COLOR-SIZE`), `barcode_ean`.
8.  **BOM Recipe (`boms`)**: `id`, `style_id` (FK to `styles`), `colorway` (specific or 'ALL'), `item_id` (FK to `inventory_items`), `consumption_qty`, `unit_of_measure`, `waste_allowance_pct`.
9.  **Customer PO (`purchase_orders`)**: `id`, `customer_id` (FK to `companies`), `po_number`, `order_date`, `delivery_due_date`, `status` ('Draft', 'Submitted', 'Approved', 'In Production', 'Closed').
10. **PO Line Item (`po_line_items`)**: `id`, `po_id` (FK to `purchase_orders`), `sku_id` (FK to `skus`), `ordered_qty`, `unit_price`, `total_amount`.
11. **Work Order (`work_orders`)**: `id`, `po_line_item_id` (FK to `po_line_items`), `wo_number`, `facility_id`, `target_qty`, `starting_stage_id`, `current_stage_id`, `status`.
12. **Cut Ticket (`cut_tickets`)**: `id`, `work_order_id` (FK to `work_orders`), `cut_number`, `marker_name`, `fabric_lot_number`, `total_layers`, `planned_pcs`, `status`.
13. **Bundle Unit (`bundles`)**: `id`, `cut_ticket_id` (FK to `cut_tickets`), `sku_id` (FK to `skus`), `bundle_barcode` (Unique QR), `shade_lot`, `bundle_qty`, `current_operation_id`, `status`.
14. **QC Log (`qc_inspections`)**: `id`, `bundle_id` (FK to `bundles`), `inspector_id` (FK to `profiles`), `defect_category`, `defect_code`, `inspected_qty`, `passed_qty`, `failed_qty`, `rework_action`.
15. **Inventory Item Master (`inventory_items`)**: `id`, `item_code`, `item_name`, `category` ('Fabric', 'Trim', 'Packaging', 'Chemical'), `uom`, `minimum_reorder_level`.
16. **Inventory Lot (`inventory_lots`)**: `id`, `item_id` (FK to `inventory_items`), `facility_id`, `lot_number`, `quantity_on_hand`, `allocated_qty`, `available_qty`, `location_bin`.
17. **Carton & Packing List (`cartons`, `packing_lists`)**: `id`, `packing_list_number`, `carton_barcode`, `destination_address_id` (FK to `address_book`), `shipped_date`, `tracking_number`.

---

## SECTION 3: Role & Permission Matrix (RBAC)

| Module / Operational Domain | Super Admin | Admin | Merchandiser | Production Mgr | Cutting Sup. | Sewing Sup. | QC Inspector | Warehouse / Dispatch | Customer (Scoped) | Finance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User & Role Admin** | CRUD | CRUD | - | - | - | - | - | - | - | - |
| **Customer & Company CRM** | CRUD | CRUD | CRU | R | - | - | - | R | R (Own Profile) | R |
| **Address & Contact Book** | CRUD | CRUD | CRU | R | - | - | - | R | CRU (Own Data) | R |
| **Styles, SKUs & Size Ranges**| CRUD | CRUD | CRUD | R | R | R | R | R | R (Own Styles) | - |
| **BOM Templates & Costing** | CRUD | CRUD | CRUD | R | R | - | - | - | R (View Approved)| R |
| **Sales POs & Intake Approval**| CRUD | CRUD | CRUD | R | - | - | - | - | C / R (Own POs) | R |
| **Work Orders & Scheduling** | CRUD | CRUD | R | CRUD | R | R | - | - | R (Status Only) | - |
| **Cutting Tickets & Bundles** | CRUD | CRUD | R | CRUD | CRUD | R | - | - | - | - |
| **Shop Floor / Sewing Tracking**| CRUD | CRUD | R | CRUD | R | CRUD | R | - | - | - |
| **Quality Control & RCA Logs** | CRUD | CRUD | R | R | R | R | CRUD | - | - | - |
| **Inventory, Receipts & Lots** | CRUD | CRUD | R | R | R | - | - | CRUD | - | R |
| **Packing, Cartons & Dispatch**| CRUD | CRUD | R | R | - | - | R | CRUD | R (POD Only) | R |
| **Invoicing & Accounts** | CRUD | CRUD | R | - | - | - | - | R | R (Own Invoices) | CRUD |

*Legend: C = Create, R = Read, U = Update, D = Delete, - = No Access*

---

## SECTION 4: Step-by-Step User Flow Diagrams

### Flow A: Admin Invites & Provisions a User
1.  Admin accesses `User Management` in System Settings. Open registration (`/signup`) is disabled.
2.  Admin clicks **"Invite New User"**.
3.  Admin enters user's Email, Full Name, assigned Role (`merchandiser`, `production`, `qc`, `customer`, etc.), and assigned Facility (`Sewing Facility`, `Laundry Facility`, or `Both`).
4.  *Branching Check:* If Role == `customer`, the form enforces selection of a validated `Company` from the CRM database.
5.  System generates a secure invite token via Supabase Auth Admin API and dispatches an invitation email.
6.  User clicks the link, sets their password, and is automatically logged into their role-scoped dashboard.

### Flow B: Order Intake (Branching for New vs. Existing Customer)
```
[Start Order Intake] ───> "Is Customer New or Existing?"
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
[Select Existing Customer]                  [Create New Customer]
  ├── Validates Company & Status               ├── Input Company Name & Tax ID
  ├── Pre-fills Billing & Shipping Addresses  ├── Add Billing & Shipping Addresses
  └── Pre-fills Contacts & Terms              └── Create Primary Contact Person
          │                                           │
          └─────────────────────┬─────────────────────┘
                                ▼
                   [Select / Create Style & Size Range]
                   [Input SKU Quantity Grid]
                   [Attach Tech Pack & Cut Sheet]
                                ▼
                   [Generate Sales PO Header & Line Items]
```

### Flow C: Approved Order → Production Batches → SKU Conversion
1.  Merchandiser reviews the submitted Sales PO and clicks **"Approve PO"**.
2.  System validates that every Style on the PO line items has an assigned `Size Range` and an approved `BOM Template`.
3.  System executes `convert_po_to_work_orders()`:
    *   Generates individual `Work Orders` broken down by Style Code, Colorway, and Target Facility.
    *   Generates precise `SKU Master` records for every combination of Style + Color + Size specified in the order matrix.
    *   Calculates required raw materials from the BOM and auto-generates `Material Requisitions`.
4.  Production Manager reviews generated Work Orders, assigns starting lines, and authorizes cut room release.

### Flow D: Shop Floor Execution (Cutting → Bundling → Sewing → QC → Dispatch)
1.  **Cutting:** Supervisor opens Work Order, selects fabric dye lot from Inventory, and creates a `Cut Ticket`. Cut panels are logged.
2.  **Bundling:** System automatically splits cut panels into barcoded `Bundles` (e.g., Bundle #BD-1042 = 20 pcs, Size 32, Raw Indigo). Unique QR tags are printed.
3.  **Sewing:** Line operators scan bundle QR codes upon line entry and completion. Real-time WIP dashboard updates piece throughput.
4.  **QC Inspection:** QC Inspector performs in-line or end-of-line scan. 
    *   *If Pass:* Bundle moves to Wash / Packing.
    *   *If Fail:* Inspector logs defect category, photo, root cause, and operator ID. Bundle is diverted to Rework or Scrap.
5.  **Packing & Dispatch:** Warehouse operator scans passed bundles into `Cartons`, generates shipping labels, assigns cartons to a `Packing List`, and captures driver POD signature upon pickup.

### Flow E: Change-Request Flow (Customer → Merchandiser)
1.  Customer views active order in their Brand Portal and clicks **"Request Order Change"**.
2.  Customer specifies change category (*Quantity Revision*, *Delivery Date Extension*, *Wash Process Change*, *Cancel Line Item*) and uploads supporting documents.
3.  System flags the associated Sales PO and Work Orders as `CHANGE_PENDING` and alerts the assigned Merchandiser.
4.  Merchandiser reviews change request against cut room status:
    *   *If Cutting HAS NOT started:* Merchandiser updates PO/WO lines directly and clicks **"Approve Change"**.
    *   *If Cutting HAS started:* System alerts Merchandiser of WIP impact; Merchandiser enters cost adjustment or partial rejection.
5.  Customer receives automated status notification and updated contract revision log.

---

## SECTION 5: Prioritized Gap Audit List

Every gap identified in the repository audit, ranked by foundational priority:

| Rank | Gap / Flaw Found in Audit | Current Code File(s) | Correct Generic Architecture Solution |
| :--- | :--- | :--- | :--- |
| **P1** | **Open Account Self-Registration** | `src/routes/signup.tsx` | Disable public signup. Replace with Admin-driven invite modal using Supabase `auth.admin.inviteUserByEmail()`. Enforce `company_id` link for customer roles. |
| **P2** | **No Central Style & SKU Master** | `src/routes/orders.tsx`, DB `orders` table | Replace text fields (`style_name`, `colorway`) with relational `styles` and `skus` tables. SKUs must represent explicit Style + Color + Size combinations. |
| **P3** | **Hardcoded Jeans Size Matrix** | `src/components/apply-portal/SizeMatrixGrid.tsx` | Build a generic `size_ranges` master table supporting dynamic numeric, alpha (XS-XXL), youth, and custom size scales assigned per style. |
| **P4** | **Missing Order Intake Customer Branching** | `src/routes/apply-intake.tsx` | Redesign step 1 of intake to force selection of a validated `Company` record, auto-populating addresses, tax IDs, and existing customer PO constraints. |
| **P5** | **Duplicated Inventory Tracking** | `materials.tsx`, `inventory.tsx`, RMI tables | Unify `materials`, `raw_materials_intake`, and `inventory_items` into a single single-source-of-truth inventory model tracking Goods Receipt Notes (GRN), Lot numbers, and Bin allocations. |
| **P6** | **Disconnected Cut Room & Bundles** | `cutting.tsx`, DB `cutting_records` | Link `cut_tickets` directly to `work_orders`. Auto-generate QR-barcoded `bundles` upon cut ticket completion that feed directly into sewing scan events. |
| **P7** | **Incomplete CRM Profile Data** | DB `customers` table | Replace basic `customers` table with a full CRM schema including `companies`, multi-entry `address_book`, and `contacts`. |
| **P8** | **Loose RLS & Permission Scoping** | `supabase/migrations/*.sql` | Replace string-matching RLS policies (`customer_name = name`) with strict UUID foreign key checks (`company_id` and authenticated `role`). |
| **P9** | **Missing BOM Costing Integration** | `src/routes/apply.index.tsx` | Require an approved `bom_templates` link during order approval to calculate material requirements and block WO release if stock is unreserved. |

---

## SECTION 6: Generic vs. Configurable Architecture Rules

To guarantee that Forge & Fabric functions as a universal garment ERP while allowing brand-specific customization:

### 6.1 What Must Remain Strictly Generic (System Core)
*   **Database Schema & Relationships:** Company $\rightarrow$ PO $\rightarrow$ WO $\rightarrow$ Cut Ticket $\rightarrow$ Bundle $\rightarrow$ Carton hierarchy.
*   **State Machine Lifecycles:** Order statuses (`Draft` $\rightarrow$ `Approved` $\rightarrow$ `In Production` $\rightarrow$ `Shipped`) and Gate validation logic.
*   **RBAC Security Layer:** Role definitions, RLS policies, and API permission boundaries.
*   **Inventory Accounting Principles:** Available Qty = Quantity On Hand - Allocated Qty.

### 6.2 What Must Remain Configurable-Per-Brand (Tenant Config)
*   **Size Scales & Grading:** Defined in database configuration tables per style, never hardcoded in React TSX code.
*   **Manufacturing Routing Stages:** Sequential operations (e.g., Cut $\rightarrow$ Sew vs. Cut $\rightarrow$ Sew $\rightarrow$ Print $\rightarrow$ Wash) configured per style category.
*   **Defect Taxonomies:** QC defect codes and inspection checkpoints loaded dynamically from setup tables.
*   **UI Branding & Aesthetics:** Brand logos, primary theme colors, facility labels, and document header templates fetched from tenant settings rather than hardcoded Tailwind CSS classes.
