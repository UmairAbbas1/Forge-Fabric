# Forge & Fabric Industries, Inc. — Master Project Reference

**Purpose of this file:** This is the single, canonical reference for the entire Forge & Fabric ERP/MES project — what it is, how it's built, how data flows front-to-back, every role and module, every requirement implemented, and every known gap. It replaces all previous scattered architecture/gap/runbook docs (see "Superseded Documents" at the bottom). Use this file as onboarding context for any new AI session or engineer working on this codebase, and as the base to layer new requirements onto.

**Status as of:** 2026-08-19. Reflects the codebase after the V2 specification upgrade (migration `20260823000000_v2_spec_production_upgrade.sql`), verified against actual route/component/migration files, not just design docs.

---

## 1. What This Product Is

Forge & Fabric is a production-grade, multi-tenant **industrial ERP/MES (Manufacturing Execution System)** for a real apparel "Cut, Make, Wash, Pack" (CMT) factory operation, built for **Forge & Fabric Industries, Inc.**, a contract manufacturer that converts customer-supplied or factory-sourced fabric into finished garments (denim, knitwear, wovens) for multiple competing apparel brands (multi-tenant / multi-brand).

It spans two physical facilities:
- **San Leandro** — Cutting & Sewing
- **Petaluma** — Laundry, Finishing & Distribution

It is used simultaneously by:
- **Internal staff** (admins, merchandisers, production managers, cutting/sewing supervisors, QC inspectors, warehouse staff, finance) running the shop floor and back office, and
- **External brand customers** (Weissmade, Fear of God, Servade, Levi's, etc.) who submit orders, track status, and approve pricing/samples through a public self-service portal — with strict data isolation between brands.

This is not a demo — it is treated as a real client production system. Every feature must be end-to-end wired: database schema → RLS security → backend hook/RPC → UI → real-time sync.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TypeScript |
| Routing | TanStack Router (Start) — file-based routes in `src/routes/`, compiled to `src/routeTree.gen.ts` via `npx @tanstack/router-cli generate` (runs automatically as `prebuild`) |
| Build tool | Vite |
| Data fetching/cache | TanStack Query (used in newer hooks); most routes call Supabase directly inline |
| Forms/validation | react-hook-form + Zod (`src/lib/validation/*.ts`) |
| Styling | Tailwind CSS, custom CSS variables for white-label theming |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage), accessed via PostgREST / `@supabase/supabase-js` |
| Deployment | Vercel Edge / Cloudflare Workers (nitro build output present) |
| Icons | lucide-react |

**No custom backend server** — all business logic lives in either the React client, Postgres `SECURITY DEFINER` functions (RPCs), or Row-Level Security policies. There is no Express/Node API layer.

### Supabase connection (`src/lib/supabase.ts`)
The Supabase URL and anon key have **hardcoded fallback defaults** in the source (`DEFAULT_SUPABASE_URL`, `DEFAULT_SUPABASE_ANON_KEY`), overridable by `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars. This means `isRealSupabase` is `true` essentially always — the app is *always* live-wired to the real Supabase project unless someone deliberately breaks the fallback. A `MOCK_PROFILES_KEY` localStorage-based mock user set exists as a secondary fallback path (`admin@forgefabric.com` / `merch@forgefabric.com` / `prod@forgefabric.com` / `qc@forgefabric.com` / `customer@forgefabric.com`) but is effectively dead in normal operation since real Supabase is always configured.

**Important security note:** because the anon key is hardcoded in the client bundle, it is fully public. All data protection MUST come from Postgres RLS policies — never from "the key is secret" or from UI-level hiding. (This exact assumption was violated and then fixed during the V2 upgrade — see §9.)

---

## 3. The 13-Stage Manufacturing Pipeline

The whole system is organized around this physical production sequence:

| # | Stage | What Happens | Primary Route(s) |
|---|---|---|---|
| 1 | Customer Order Intake | PO header, tech pack, size breakdown captured | `/apply/new` (public), `/apply-intake` (internal), `/submissions` |
| 2 | Raw Material Receiving | Vendor GRN logged into inventory | `/materials` |
| 3 | Fabric & Trim Inspection | 4-point inspection, approve/hold gate | `/materials`, `/inventory` |
| 4 | Pre-Production Planning | Scheduling, BOM validation, line allocation | `/orders/$orderId`, `/boms` |
| 5 | Pattern / Marker / Cutting | Marker spreading, Cut Ticket execution | `/cutting` |
| 6 | Bundling & Line Feeding | Barcode bundle tags (`BND-XXXXX`), shade lot sort | `/cutting` (bundle generation) |
| 7 | Sewing Production | Barcode scan-in/out per operation, WIP tracking | `/sewing`, `/tablet` |
| 8 | Pre-Wash QC | Inline seam/construction audit | `/qc` |
| 9 | Laundry / Wash / Dry | Industrial wash, stonewash, enzyme, dry | `/wash` |
| 10 | Laser / Ozone / Spray / 3D Finish | Distressing, fading, finishing effects | `/wash` |
| 11 | Final Quality Inspection | AQL 2.5 audit, rework routing | `/qc` |
| 12 | Pressing / Tagging / Packing | Steam press, hangtag, carton packing | `/dispatch` |
| 13 | Finished Goods Dispatch | Address linkage, driver POD, PO fulfillment cascade | `/dispatch`, `/finance` |

Any stage can be **outsourced to an external vendor** (see REQ-08, §9) — cutting in one city, printing outsourced, finishing in-house, etc.

---

## 4. Roles & Permissions (RBAC)

Single source of truth: `src/lib/permissions.ts`. RBAC is enforced at **two independent layers** that must both be kept in sync when adding a feature:
1. **Frontend gate** — `usePermission(module, action)` hook / inline role checks, hides/disables UI.
2. **Database gate** — Postgres RLS policies using `is_internal_staff()`, `is_admin_user()`, `get_auth_user_company_id()` (all `SECURITY DEFINER` functions reading `public.profiles`). **The DB layer is the real security boundary** — the frontend layer is UX only, since the anon key is public.

### Roles
`super_admin`, `admin`, `merchandiser`, `production_manager`, `cutting_supervisor`, `sewing_supervisor`, `qc_inspector`, `warehouse`, `customer`, `finance` — plus two legacy aliases still recognized everywhere: `production` (→ normalizes to `production_manager`), `qc` (→ normalizes to `qc_inspector`).

`super_admin` and `admin` always pass every permission check (hard override in `hasPermission()`).

### Permission Matrix (Module × Role → Create/Read/Update/Delete)

| Module | super_admin/admin | merchandiser | production_manager | cutting_sup. | sewing_sup. | qc_inspector | warehouse | customer | finance |
|---|---|---|---|---|---|---|---|---|---|
| `admin` | CRUD | - | - | - | - | - | - | - | - |
| `crm` | CRUD | CRU | R | - | - | - | R | CRU (own) | R |
| `product_master` | CRUD | CRUD | R | R | R | - | - | R (own) | R |
| `orders` | CRUD | CRUD | R | - | - | - | - | CR (own, scoped) | R |
| `production_planning` | CRUD | R | CRUD | R | R | - | - | R (status only) | - |
| `shop_floor` | CRUD | R | CRUD | CRU | CRU | - | - | - | - |
| `qc` | CRUD | R | R | R | R | CRU | - | - | - |
| `inventory` | CRUD | CRU | CRU | R | - | - | CRUD | - | R |
| `shipping` | CRUD | R | R | - | - | R | CRUD | R (POD) | R |
| `finance` | CRUD | R | - | - | - | - | - | R (own) | CRUD |

### Real people mapped to roles (per V2 spec intent — not DB-seeded, see §10)
- **Pat** → `production_manager` (San Leandro)
- **Wesley & Joe** → `merchandiser`
- **Local Warehouse Managers** → `warehouse` (per-facility)
- **QC Inspectors** → `qc_inspector`

These must be provisioned as *real* accounts via **Settings → User Management → Invite New User** (Supabase Auth admin invite), never by raw SQL insert — a fabricated `profiles` row can't satisfy the `auth.users` foreign key.

### Facility Scope (REQ-01)
`profiles.facility_scope` (text, default `'All'`) tags each staff account to a facility (e.g. `"San Leandro Cutting & Sewing"`, `"Petaluma Distribution & Laundry"`, or `"All"`). Currently metadata/display only — set via Invite and via the **Reassign** modal in `/settings/users` — not yet enforced as a hard data filter anywhere.

---

## 5. Full Route / Module Map

### Public (unauthenticated)
| Route | Purpose |
|---|---|
| `/` (`index.tsx`) | Public landing / marketing splash |
| `/about`, `/contact`, `/privacy`, `/terms` | Static public pages |
| `/login`, `/signup` | Auth (signup is display-only — **public self-registration is disabled**, redirects to "contact your admin") |
| `/apply` (`apply.index.tsx`) | Client self-service portal landing |
| `/apply/new` | Multi-step public order intake wizard (see §8, Flow B) |
| `/apply/status/$referenceCode` | Public order status lookup by reference code + email (no login) — served by `get_submission_status_by_reference()` RPC |
| `/apply/thank-you` | Post-submission confirmation |
| `/apply/update` | Public change-request submission |

### Internal — Order Intake & Merchandising
| Route | Purpose |
|---|---|
| `/apply-intake` | Internal merchandiser direct order/Blanket-PO intake wizard |
| `/submissions` | Merchandiser inbox for all incoming submissions (bulk orders, samples, etc.) |
| `/submissions/$submissionId` | Submission detail + pricing quote issuance + conversion to Work Orders |
| `/submissions/$submissionId/cut-sheet` | Interactive cut sheet spreadsheet editor |
| `/update-requests` | Client change-request resolution board |
| `/sku-mapping` | Customer SKU ↔ factory style code cross-reference |

### Internal — Product Master / PLM
| Route | Purpose |
|---|---|
| `/styles` | Style & Product Master directory |
| `/styles/$styleId` | Style detail — colorways, size scale, bulk SKU generator, **Tech Pack Vault** (REQ-05) |
| `/size-ranges` | Size Range Master (dynamic numeric/alpha/kids/custom scales) |
| `/boms` | BOM recipe builder (fabric consumption, waste %, costing) |

### Internal — Shop Floor MES
| Route | Purpose |
|---|---|
| `/orders`, `/orders/$orderId` | Order dashboard & detail — stage tracker, **Stage Outsourcing panel** (REQ-08) |
| `/materials` | Material Receiving / GRN log — **REQ-02 approval gate** |
| `/inventory` | Unified multi-location inventory hub — fabric lots, trims, issuance — **REQ-02 approval gate** |
| `/cutting` | Cut Ticket creation, fabric lot allocation gate, bundle barcode generation |
| `/sewing` | Sewing line bundle scan tracking |
| `/wash` | Laundry/finishing batch tracking |
| `/qc` | Defect logging, AQL checkpoints, rework queue, **rework/COPQ capture** (REQ-13) |
| `/dispatch` | Packing lists, address linkage, POD, **PO gate** (REQ-06) |
| `/shop-floor` | Simplified operator scan view |
| `/tablet` | High-contrast 60px-button kiosk mode (REQ-12) |
| `/machines`, `/process` | Equipment status, process routing diagram |

### Internal — Finance / Analytics / Compliance
| Route | Purpose |
|---|---|
| `/finance` | Billing/invoicing, **PO gate** (REQ-06) |
| `/reports` | Executive analytics — yield, defects, OTIF, **COPQ analytics** (REQ-13) |
| `/compliance`, `/sustainability` | Certifications, ESG tracking |

### Internal — Admin / Settings
| Route | Purpose |
|---|---|
| `/settings` | Admin control panel hub |
| `/settings/users` | User Management — invite, **role/facility Reassign modal** (REQ-01) |
| `/settings/branding` | Tenant white-label branding **+ operational settings** (sample governance, capacity scheduling — REQ-04/REQ-09) |
| `/account` | Own profile/password |

---

## 6. Backend Architecture Patterns

### 6.1 Data access pattern
Most routes call `supabase.from(...)` **directly inline** inside the component (no repository/service layer). Newer merchandiser-facing code uses dedicated hooks under `src/hooks/merchandiser/*` with TanStack Query. Nearly every write path is wrapped in `try/catch` with `console.warn` fallback so a single failed insert doesn't crash the page — but this means silent partial failures are possible and worth checking in devtools when debugging.

### 6.2 Realtime + local reactivity
Two mechanisms run in parallel:
- **Supabase Realtime** (`postgres_changes` on tables added to the `supabase_realtime` publication) for genuine cross-client sync. **Realtime obeys the same RLS as REST** — an anonymous visitor cannot get realtime pushes for rows they couldn't SELECT.
- **Custom `window.dispatchEvent(new CustomEvent("forge_submission_created", ...))`** browser events + `localStorage` caches, used for same-tab/same-browser instant UI feedback without waiting on a round-trip.

### 6.3 Row-Level Security model
Every table uses one of these patterns:
- **Staff-only**: `FOR ALL TO authenticated USING (is_internal_staff())`
- **Staff + own-company customer read**: staff OR `company_id = get_auth_user_company_id()` OR name-match fallback
- **Public intake**: `FOR INSERT TO anon, authenticated WITH CHECK (true)` — anon can create, never read others' rows
- **SECURITY DEFINER RPC** for any public read that needs cross-referencing PII (order status lookup, price quote response) — the RPC does the ownership check (reference code + email match) server-side instead of relying on a client-side filtered SELECT

Helper functions (defined in `20260811000600` and re-confirmed by every later security-touching migration):
```sql
get_auth_user_role()        -- current user's role
get_auth_user_company_id()  -- current user's linked company (customers)
is_internal_staff()         -- true for all non-customer, non-deactivated roles
is_admin_user()             -- true for admin/super_admin only
```

### 6.4 Public-facing RPCs (bypass RLS safely via SECURITY DEFINER)
- `get_submission_status_by_reference(reference_code, email)` — powers `/apply/status/$referenceCode` with zero login. Uses dynamic `EXECUTE`-wrapped child-table lookups with exception handling to survive schema drift on `update_requests`.
- `respond_to_price_quote(quote_id, reference_code, email, response)` — lets an anonymous customer Accept/Reject a price quote from the same status page.

### 6.5 ⚠️ Known architectural quirks (read before touching these areas)
1. **Two parallel "material receiving" systems** exist: `src/routes/materials.tsx` (writes to both the `materials` table and `inventory_lots`) and `src/routes/inventory.tsx` (reads/writes `inventory_lots` directly). Both write to the *same* `inspection_status` field that `cutting.tsx`'s floor-lockout reads, and **both now carry the identical warehouse-only approval gate** (fixed 2026-08-19 — previously `materials.tsx` had no gate at all, letting any staff role bypass the lockout). If you touch approval logic, you must change **both** files identically.
2. **Two unrelated "tenant settings" tables exist**: `public.tenant_config` (created by `20260811000800`) is the **real, UI-backed** singleton settings row — it powers `ThemeContext.tsx` / `/settings/branding` and now also holds `sample_min_turnaround_days`, `sample_max_quantity`, `daily_capacity_units`, `laundry_buffer_days`. `public.tenant_branding` (created later by `20260818000000`) is an **orphaned table nothing in the working app reads** — it exists only because an old migration created it with an open RLS hole, which was closed for safety, but it should not be used for new features. Always use `tenant_config`.
3. **Core legacy tables predate the tracked migration history**: `orders`, `materials`, `profiles`, `customers`, `qc_records`, `cartons` are not created by any file in `supabase/migrations/` — they existed in the live database before migration tracking began (likely from the original Lovable scaffold). Don't assume every column has a corresponding migration — verify against the live schema.
4. **Schema drift is real and has bitten this project twice** (see `20260823000000`'s "SCHEMA-DRIFT INSURANCE" section) — columns read/written extensively throughout the app (`inventory_lots.inspection_status`) turned out not to exist in the live DB. Any new migration touching an existing table should guard every referenced column with `ADD COLUMN IF NOT EXISTS` before using it in a `CREATE POLICY`, `CHECK`, or static `WHERE`.

---

## 7. Database Schema Reference (by domain)

*(Table exists per `CREATE TABLE` in `supabase/migrations/*.sql`, unless marked "pre-migration legacy")*

**CRM / Company Master:** `companies`, `address_book`, `contacts`, `customers` *(pre-migration legacy, superseded by `companies`)*

**Auth / Users:** `profiles` *(pre-migration legacy — extended by many migrations: role, company_id, facility_scope, deactivated)*

**Product Master / PLM:** `styles`, `skus`, `size_ranges`, `size_ratios`, `size_templates`, `bom_templates`, `boms`

**Sales / Orders:** `orders` *(pre-migration legacy, still the live table dispatch/finance actually use)*, `purchase_orders`, `po_line_items`, `po_revision_requests`, `blanket_pos`, `work_orders`

**Public Intake Portal:** `apply_submissions`, `apply_cut_sheets`, `apply_documents`, `merchandiser_assignments`, `update_requests`, `sample_requests`, `sample_request_documents`

**Materials & Inventory:** `materials` *(pre-migration legacy)*, `raw_materials_intake`, `material_inbound_expectations`, `material_sourcing_requests`, `material_requisitions`, `inventory_items`, `inventory_lots`, `inventory_issuances`

**Shop Floor MES:** `cut_tickets`, `bundles`, `scan_events`, `stage_jump_logs`, `stage_outsourcing_records`

**Quality:** `qc_records` *(pre-migration legacy)*, `qc_inspections`, `qc_checkpoints`, `qc_defect_logs`, `rework_logs`

**Shipping/Dispatch:** `cartons` *(pre-migration legacy)*, `packing_lists`, `delivery_manifests`, `order_documents`

**Finance:** `invoicing_records`, `price_quotes`

**Reference / Mapping:** `sku_mappings`

**System / Settings:** `tenant_config` (real settings singleton), `tenant_branding` (orphaned, unused — see §6.5), `equipment`, `notification_logs`, `migration_exceptions`

**V2-added:** `tech_pack_vault`, `price_quotes`, `stage_outsourcing_records`, `rework_logs` (all documented in §9)

---

## 8. End-to-End User Flows

### Flow A — Admin Invites & Provisions a User
1. Admin opens **Settings → User Management** (`/settings/users`). Public self-registration is disabled.
2. Clicks **Invite New User** → enters email, name, role, and (for staff) facility scope.
3. If role = `customer`, form **hard-locks** until a validated `companies` record is selected.
4. Supabase Auth Admin API (`admin.inviteUserByEmail`) sends the invite; a matching `profiles` row is created/upserted with `company_id`/`facility_scope`.
5. User accepts, sets password, lands on their role-scoped dashboard.
6. To change someone's role/facility later without recreating the account: same page → **Reassign** button on their row (REQ-01).

### Flow B — Public Order Intake (branching)
```
/apply/new
  → Step 1: Select existing Company (pre-fills address/contacts) OR create new brand
  → Step 2: Choose classification: New Bulk Order | Sample Request | Rush Production | Order Update
       (each classification routes to its own dedicated Subform — see §11 "Classification Subforms Pattern")
  → Step 3: Style/SKU + generic SizeMatrixGrid (columns driven by the style's assigned size_range — never hardcoded)
  → Step 4: Attach tech pack / cut sheet
  → Step 5: Submit → apply_submissions row created, reference code generated, confirmation page shown
```
For **Sample Request** specifically (REQ-04): quantity is capped (configurable, default 100 pcs), turnaround date has a configurable minimum (default 3 days), and the customer's own SKU is captured separately from the factory's official Master SKU/Quote Number (assigned later by a merchandiser).

### Flow C — Submission → Pricing Approval → Work Orders
1. Merchandiser opens the submission in `/submissions/$submissionId`.
2. If unquoted: clicks **Issue Price Quote** → cost calculator (CMT + wash + trims + margin% → final unit price) → **Send to Customer** (REQ-07).
3. Customer (no login required) opens `/apply/status/$referenceCode`, sees the quote card, clicks **Accept** or **Reject**.
4. Once accepted (or if a Sample was already `Sample_Approved`), merchandiser clicks **Approve PO & Convert to Work Orders** — validates style has an approved BOM + size range, then Work Orders + SKUs + Material Requisitions are generated.
5. For Sample Requests specifically: **Convert to Bulk Production Order** stays disabled until `sample_status = Sample_Approved` AND both Master SKU and Quote Number have been entered by the merchandiser (REQ-04 governance gate).

### Flow D — Shop Floor Execution (Cutting → Bundling → Sewing → QC → Dispatch)
1. **Cutting** (`/cutting`): supervisor selects a fabric lot — only lots with `inspection_status = 'Approved'` are selectable (REQ-02 floor lockout); creates Cut Ticket; system auto-generates barcoded Bundles (`BND-XXXXX`).
2. **Sewing** (`/sewing`, `/tablet`): operators scan bundle barcodes at each operation; `scan_events` logged; tablet mode gives 60px touch targets for glove-friendly floor use (REQ-12).
3. **QC** (`/qc`): inspector logs pass/fail counts + defect taxonomy. On `Rework`, captures rework station, labor minutes, and scrap yardage — auto-calculates Cost of Poor Quality (REQ-13). Customer-facing views never show internal operator names/machine IDs (Privacy Shield).
4. **Dispatch** (`/dispatch`): warehouse creates a Packing List against an address-book destination — **blocked without a valid PO number** (REQ-06) — captures driver POD, cascades fulfillment status to the Work Order/PO.
5. **Finance** (`/finance`): Generate Invoice / Mark Paid — also **PO-gated** (REQ-06).

Any of these 13 stages can instead be routed to an **outside vendor** via the Stage Outsourcing panel on the order detail page — tracks vendor, outsource PO#, dispatched/received quantity, cost, and return status (REQ-08).

### Flow E — Material Receiving Approval (REQ-02)
1. Any staff role can log a Goods Receipt Note (BOL, yardage, GSM, 4-point score) in `/materials`, landing as `inspection_status = 'Pending'`.
2. **Only Warehouse / Admin / Super Admin** can flip it to `Approved` (release to production) — enforced identically in both `/materials` and `/inventory`, client-side gate + UI disabling + optimistic clamp. `Hold` (quarantine, with a required reason) can be set by any manager role.
3. Cutting's fabric-lot selector reads `inspection_status` from both the `materials` and `inventory_lots` tables and excludes anything not `Approved`.

### Flow F — Customer Change Request
1. Customer requests a change from their portal view (`/apply/update`) — quantity revision, date extension, wash change, or cancellation.
2. Associated PO/Work Orders flagged `CHANGE_PENDING`; merchandiser alerted via `/update-requests`.
3. If cutting hasn't started, merchandiser edits PO/WO lines directly and approves. If cutting has started, merchandiser must resolve WIP impact (cost adjustment or partial rejection) before approving.

---

## 9. V2 Specification — Requirement Status (REQ-01 through REQ-13)

Source spec: `FORGE_FABRIC_MES_SPECIFICATION_V2.md` (folded into this doc; original file removed — see bottom). Implemented via `supabase/migrations/20260823000000_v2_spec_production_upgrade.sql` plus the corresponding frontend changes below. REQ-10 (RFID) and REQ-11 (QuickBooks/ERP sync) are **explicitly Phase 3 roadmap per the spec itself** and are not implemented — no hardware/external API exists to integrate against yet.

| # | Requirement | Status | Implementation |
|---|---|---|---|
| REQ-01 | Role/Facility mapping + dynamic reassignment | ✅ Done | `profiles.facility_scope`; Reassign modal in `/settings/users` (`UserManagement.tsx`). Named seed accounts (Pat/Wesley/Joe/Warehouse) **not** SQL-seeded — must be invited for real (fabricated `auth.users` FK isn't possible via SQL). |
| REQ-02 | Material Receiving (GRN) approval gate | ✅ Done | `inventory_lots.inspection_status/approved_by_*/rejection_reason` + CHECK constraint. Warehouse/Admin-only approval gate in **both** `materials.tsx` and `inventory.tsx` (identical, must stay in sync — see §6.5). Cutting floor-lockout filters unapproved lots. Digital *signature image* not implemented — audit trail is `approved_by_name` + `approved_at` text/timestamp only. |
| REQ-03 | Zero-trust multi-brand RLS isolation | ✅ Done (critical fix) | Closed a real, live security hole: multiple tables had permissive `USING (true)` policies (RLS policies OR together, so one open policy defeats all careful ones) exposing all customer data to the public anon key. Replaced with `is_internal_staff()`/company-scoped policies; public features preserved via narrow anon INSERT + `SECURITY DEFINER` RPCs instead of open SELECT. |
| REQ-04 | Sample request governance (turnaround/cap/approval/SKU) | ✅ Done | `sample_status` enum (`Sample_Requested → In_Sample_Making → Sample_Completed → Sample_Approved/Rejected → Converted_To_Bulk`), `client_reference_sku` vs merchandiser-locked `master_product_sku`/`quote_number`. Turnaround (default 3 days) and cap (default 100pc) are **configurable via `/settings/branding`**, read live by `SampleRequestSubform.tsx` from `tenant_config` (fixed 2026-08-19 — was previously hardcoded and pointed at the wrong/orphan table). |
| REQ-05 | Tech pack centralized vault | ✅ Done | `tech_pack_vault` table + private `tech-packs` storage bucket, versioned (`v1`, `v2`...), staff full access / customer read scoped to own `company_id` folder. Mounted on `/styles/$styleId`. Google Drive archival mirror **not implemented** (external OAuth integration, out of scope). |
| REQ-06 | PO prerequisite gate for invoicing & dispatch | ✅ Done | `orders.po_document_url`, `packing_lists.po_verified`. Client-side gate blocks Dispatch/POD and Generate Invoice/Mark Paid without a valid PO. |
| REQ-07 | Pricing approval & quoting workflow | ✅ Done | `price_quotes` table, `PricingQuoteModal.tsx` cost calculator, `apply_submissions.pricing_status`, `respond_to_price_quote()` RPC for anonymous customer Accept/Reject on the public status page. **Gap**: "repeat orders auto-link to existing quotes" from the spec is **not implemented** — no matching logic exists; needs a business-rule decision (what counts as "the same" order) before building, since it touches pricing/billing judgment. |
| REQ-08 | Universal outsourcing for all 13 stages | ✅ Done | `stage_outsourcing_records` table, `StageOutsourcingPanel.tsx` mounted on `/orders/$orderId` (consolidated single panel with a stage-number picker covering all 13 stages, rather than 13 separate embedded widgets). |
| REQ-09 | Capacity-based delivery date scheduling | ✅ Done | `tenant_config.daily_capacity_units` (default 144,000/day) + `laundry_buffer_days` (default 2), configurable via `/settings/branding`. `calculateSuggestedShipDate()` in `src/lib/utils.ts` implements `today + ceil((backlog + new units) / daily_capacity) + buffer`. Wired into `ConversionModal.tsx` (merchandiser work-order creation) only — not yet in the public `/apply/new` intake wizard (would need either anon backlog read access or a dedicated RPC). |
| REQ-10 | UHF RFID tracking | ⛔ Not implemented | Explicit Phase 3 roadmap per spec. Requires physical hardware (readers, tags) that doesn't exist yet. |
| REQ-11 | QuickBooks/Fishbowl/Ames360 sync | ⛔ Not implemented | Explicit Phase 3 roadmap per spec. Requires external API credentials/OAuth setup. |
| REQ-12 | Tablet/mobile shop floor touch interface | ✅ Done | `/tablet` route — clock-in, barcode scan, 60px action buttons (START BUNDLE / LOG PASS / LOG DEFECT / COMPLETE STAGE), defect code picker. Badge "scan" is a text input a USB/BT barcode scanner types into (standard pattern), not a distinct hardware integration. |
| REQ-13 | Rework labor/scrap/COPQ tracking | ✅ Done | `rework_logs` table with a `GENERATED ALWAYS AS` computed `calculated_copq_usd` column (labor cost + scrap fabric cost). Captured inline in `/qc` when a defect is logged as `Rework`. COPQ analytics section (total cost, top defect drivers) added to `/reports`. |

### Known Gaps / Follow-Ups Register
1. **REQ-01 seed accounts** — Pat, Wesley, Joe, Warehouse Supervisors must be invited through the real UI with real email addresses; nothing is pre-seeded.
2. **REQ-02 digital signature** — audit trail is name+timestamp, not a captured signature image.
3. **REQ-05 Google Drive mirror** — not built.
4. **REQ-07 repeat-order auto-link** — not built; needs a business-rule decision first.
5. **REQ-09 capacity suggestion** — only surfaced in the merchandiser conversion flow, not the public intake wizard.
6. **REQ-01 facility_scope enforcement** — currently metadata/display only, not used to hard-filter any query.
7. Two structural quirks to always keep in mind when extending the system — see §6.5 (materials/inventory_lots duality; tenant_config/tenant_branding duality).

---

## 10. Extending the System — Patterns to Follow

### 10.1 Adding a new order-intake classification (from `CLASSIFICATION_SUBFORMS_PATTERN.md`)
The `/apply/new` wizard already supports 4 classifications (New Bulk Order, Sample Request, Rush Production, Order Update) via independent, specialized subforms rather than one generic form:
1. **DB**: new migration with dedicated tables for that classification + an atomic `SECURITY DEFINER` RPC for submission (don't overload `apply_submissions` JSON blobs if the data shape is genuinely different).
2. **Validation**: new schema in `src/lib/validation/` (Zod), enforcing the same limits server-side and client-side.
3. **Subform component**: `src/components/apply-portal/subforms/XSubform.tsx`, using `react-hook-form` + `useApplyWizard()` context for shared company info + `AddressSelector` for addresses.
4. **Wire in**: `CompanyInfoForm.tsx`'s classification selector.
5. **Merchandiser side**: dedicated dashboard tab + details panel to drive that classification's state machine (mirror `SampleRequestsDashboard.tsx` / `SampleRequestDetails.tsx`).

Core philosophy: specialize, don't generalize — a sample request is structurally different from a bulk order; don't force them into one table/UI. Always reuse `companies`/`address_book`/`styles` master data rather than duplicating it.

### 10.2 Adding any new requirement/feature (general pattern used for the V2 upgrade)
1. **Migration first**: guard every column you depend on with `ADD COLUMN IF NOT EXISTS` even on tables you're sure already have it (see §6.5 point 4 — schema drift is real here). Add RLS policies scoped by `is_internal_staff()`/company match, never `USING (true)` unless the feature is genuinely public — and if it is, prefer a narrow `SECURITY DEFINER` RPC over an open SELECT policy.
2. **Verify against `tenant_config`, not `tenant_branding`**, if adding any new configurable setting.
3. **Frontend gate**: add a role check (`usePermission` or inline role list) matching the DB policy's intent — and if the same action is reachable from more than one route (like material approval from both `materials.tsx` and `inventory.tsx`), gate **all** of them identically.
4. **Verify**: `npx tsc --noEmit` and `npm run build` must both be clean before considering a change done.
5. **Manual test**: see §11.

---

## 11. Manual QA / Smoke Test Checklist

### Golden Path (Order Intake → Fulfillment)
- [ ] **Admin invites Merchandiser** — `/settings/users` → Invite → role `merchandiser` → status shows Invited.
- [ ] **Merchandiser invites Customer** — role `customer` → company selection is hard-required (submit blocked without it).
- [ ] **Public order submission** (`/apply/new`) — Step 1 Continue button is disabled until a company is selected; size matrix columns match the chosen style's size range (never hardcoded); submit creates a reference code.
- [ ] **Submission review** (`/submissions/$submissionId`) — Approve PO & Convert to Work Orders; if style lacks BOM/size range, inline error links to `/boms`/`/size-ranges`.
- [ ] **Cutting lot gate** (`/cutting`) — only `Approved` fabric lots selectable; requesting more yards than `available_qty` blocks creation; completing generates `BND-XXXXX` bundles.
- [ ] **Sewing scan** (`/sewing`) — scanning a bundle barcode advances its operation and logs a `scan_events` row.
- [ ] **QC** (`/qc`) — log inspection with a failed qty → routes to Rework Queue; customer role never sees operator names/machine IDs.
- [ ] **Dispatch** (`/dispatch`) — Create Packing List against an address-book destination; Dispatch & Log POD; fulfillment cascades to Shipped/Closed.

### REQ-01 through REQ-13 (V2 spec) — see full walkthrough given earlier in this project's session history; summarized:
- [ ] Reassign a user's role/facility from `/settings/users` — updates immediately.
- [ ] Non-warehouse role cannot approve a material lot in **either** `/materials` or `/inventory` — option is disabled/labeled accordingly.
- [ ] Log in as different roles/companies and confirm strict data isolation (no cross-brand visibility); `/apply/new` and `/apply/status` still work fully signed out.
- [ ] Sample request >100pc or turnaround <configured minimum is blocked; values match whatever is set in `/settings/branding`.
- [ ] Upload a tech pack on `/styles/$styleId` → versions correctly, downloads via signed URL.
- [ ] Dispatch/Invoice actions blocked without a PO number.
- [ ] Issue a price quote → customer accepts/rejects from `/apply/status` with no login.
- [ ] Route a stage to an outside vendor from `/orders/$orderId`.
- [ ] Suggested ship date appears in `ConversionModal` and updates the due date field on click.
- [ ] `/tablet` clock-in → scan → START/PASS/DEFECT/COMPLETE all work with large touch targets.
- [ ] Log a Rework QC result with labor/scrap → COPQ total appears on `/reports`.

### Branding/White-labeling
- [ ] `/settings/branding` — change primary color, verify it propagates via CSS variables across the app shell and public portal instantly.

---

## 12. Setup & Local Development

```bash
npm install
npm run dev          # vite dev server
npm run build         # prebuild regenerates routeTree.gen.ts, then vite build
npx supabase db push  # apply pending migrations (or paste the migration SQL into the Supabase SQL Editor)
npx tsc --noEmit       # type-check
npm run lint
```

Env vars (optional — hardcoded fallbacks exist, see §2): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

All migrations in `supabase/migrations/` run in filename (timestamp) order and are written to be idempotent/safe to re-run (`IF NOT EXISTS` / `IF EXISTS` / `DROP POLICY IF EXISTS` guards throughout) — each file is also one transaction, so a failed migration applies nothing and can simply be fixed and re-run from the top.

---

## 13. Superseded Documents

The following files previously existed as separate, overlapping (and in places stale/inaccurate — e.g. `INVENTORY_UNIFICATION_NOTES.md` claimed `materials.tsx` had been redirected to `/inventory`, which was never true) documentation and have been consolidated into this single file, then removed to avoid conflicting/duplicate context in future sessions:
`ARCHITECTURE.md`, `ARCHITECTURE_BLUEPRINT.md`, `CLASSIFICATION_SUBFORMS_PATTERN.md`, `FORGE_FABRIC_MES_SPECIFICATION_V2.md`, `GAP_CLOSURE_REPORT.md`, `INVENTORY_UNIFICATION_NOTES.md`, `MIGRATION_RUNBOOK.md`, `SMOKE_TEST_CHECKLIST.md`.

`README.md` is kept (standard repo entry point) but trimmed to point here. `AGENTS.md` is kept as-is (Lovable platform integration notice, unrelated purpose).
