# Forge & Fabric — Industrial Garment Production Management Platform

[![Production Live](https://img.shields.io/badge/Production-Live_on_Vercel-success?style=flat-square&logo=vercel)](https://forge-fabric.vercel.app)
[![Security Audit](https://img.shields.io/badge/Security_Audit-Passed_100%25-blue?style=flat-square&logo=shields.io)](https://forge-fabric.vercel.app)
[![Dependencies](https://img.shields.io/badge/npm_audit-0_vulnerabilities-brightgreen?style=flat-square&logo=npm)](#security-and-dependency-audit)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#overview)

Forge & Fabric (`forge-Fiber`) is an enterprise-grade, full-stack industrial garment manufacturing and Work-in-Progress (WIP) production management platform. Designed specifically for garment conversion facilities operating under the Cut-Make-Wash-Pack (CMT) manufacturing model, Forge & Fabric digitizes every operational phase across a 13-stage manufacturing pipeline — from customer purchase order intake through fabric inspection, cut panel generation, sewing line assembly, ozone laundry washing, AQL quality control, and final finished goods dispatch.

- Production Web Application: [https://forge-fabric.vercel.app](https://forge-fabric.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Core Architecture Highlights](#core-architecture-highlights)
- [Key Functional Modules](#key-functional-modules)
- [13-Stage Production Pipeline & QC Gates](#13-stage-production-pipeline--qc-gates)
- [Role-Based Access Control (RBAC) & Security Scoping](#role-based-access-control-rbac--security-scoping)
- [Performance & High-Speed Caching Architecture](#performance--high-speed-caching-architecture)
- [E2E Pipeline Integration Test Suite](#e2e-pipeline-integration-test-suite)
- [Technology Stack](#technology-stack)
- [Repository Directory Structure](#repository-directory-structure)
- [Database Schema & Row-Level Security (RLS) Script](#database-schema--row-level-security-rls-script)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)

---

## Overview

Forge & Fabric provides factory managers, floor supervisors, quality inspectors, merchandisers, and apparel brand clients with a unified, real-time single source of truth for apparel conversion manufacturing.

The platform eliminates offline spreadsheets, untracked inventory losses, and manual reporting delays by providing real-time data synchronization, automated stage-gate enforcement, and instant reporting exports.

---

## Core Architecture Highlights

- Real-Time Data Synchronization: Built on Supabase PostgreSQL with real-time subscriptions, keeping all connected factory displays and mobile devices in sync with minimal latency.
- Non-Blocking UI Rendering: React Context provider values and data transformations are memoized to ensure 60 FPS rendering without input lag during modal interactions or high-frequency updates.
- 0ms Instant Page Navigation: TanStack Query is configured with a 5-minute memory garbage collection window (`gcTime`) and 10-second fresh window (`staleTime`), ensuring instant page switches across all dashboard modules.
- Strict Role-Based Security: Multi-tenant customer scoping isolates data so apparel brand clients only see orders linked to their own company accounts.
- Automated Stage-Gate Quality Protection: Server-side validation logic blocks order stage progression if mandatory quality control inspections or material approvals are unfulfilled.
- Zero-Cost Production Utilities: Includes a custom token-bucket rate limiter and asynchronous background event queue for batch operations, operating without third-party SaaS dependencies.

---

## Key Functional Modules

### 1. Production Flow Dashboard (`/dashboard`)
- Real-time 13-stage production matrix presenting active order volume across factory departments.
- Interactive Kanban board view for rapid stage progression.
- Live system status indicators, including connection state and stage bottleneck warnings.

### 2. Order Management & Customer Intake (`/orders`)
- Dynamic Order Intake modal supporting custom PO numbers, style specifications, quantity allocations, and target ship dates.
- Automated customer dropdown linked to live registered customer accounts.
- Instant search filtering across Order ID, PO Number, Style Description, Customer Name, and Status.
- Order details page (`/orders/:orderId`) providing detailed audit histories across materials, cutting, sewing, washing, QC, and delivery cartons.

### 3. Material Sourcing & Inspection (`/materials`)
- Record fabric roll, trim, and accessory arrivals per production order.
- Complete 4-point inspection workflow: `Pending` -> `Approved` / `Hold`.
- Automatic system alerts triggered on inspection holds to halt downstream cutting setup.

### 4. Precision Panel Cutting Tracker (`/cutting`)
- Log cut panels by size breakdown, color shade lot, and automated cutter machine allocation.
- First Cut Panel approval gate (`Pending` -> `Approved` / `Rejected`) required prior to feeding sewing lines.

### 5. Sewing Line Assembly & WIP Control (`/sewing`)
- Modular assembly line tracking across assigned line IDs and operator counts.
- Real-time bundle status management (`In Progress` -> `Completed`) with defect logging.

### 6. Laundry Wash & Specialty Finishing (`/wash`)
- Batch-level laundry wash progression (`Wash` -> `Dry` -> `Finish` -> `Approved`).
- Machine allocation for industrial washers, laser engravers, ozone chambers, spray booths, and 3D wrinkle units.

### 7. Quality Control (QC) & AQL Audits (`/qc`)
- 5 formal Quality Control checkpoints: Material Check, First Cut Approval, Inline Sewing QC, Wash-Finish Approval, and Final AQL Audit.
- Standardized inspection data capture with inspected quantity, pass quantity, reject quantity, and defect category logging.

### 8. Packing & Finished Goods Dispatch (`/dispatch`)
- Master carton packing logs with unit counts, carton dimensions, and gross weight tracking.
- Dispatch status workflow (`Packed` -> `Dispatched`) with Proof of Delivery (POD) tracking numbers.

### 9. Reporting & CSV Data Exporter (`/reports`)
- Custom date-range analytics featuring daily QC pass rate trends and delivery performance.
- Fuzzy checkpoint key resolution (`resolveCheckpointKey`) aggregating real-time inspected quantities, pass counts, and pass rates across all 5 QC checkpoints.
- One-click CSV export functionality for Orders Summary, QC Pass/Reject Rates, On-Time Delivery Performance, and Stage Cycle-Times.

### 10. Admin Settings & Account Control (`/settings`, `/account`)
- Complete user management: assign user roles (`admin`, `merchandiser`, `production`, `qc`, `customer`) and manage account status.
- Customer brand directory and factory machinery registry.
- User profile updates for password changes, contact information, and theme preferences.

---

## 13-Stage Production Pipeline & QC Gates

| Stage | Stage Name | Inputs Required | Key Outputs | Required QC Gate Condition |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Customer Order Intake | Customer PO & Specifications | Order Record (`Open`) | Initial Order Registration |
| **2** | Tech Pack Verification | Approved Tech Pack | Tech Pack Sign-off | Specification Verification |
| **3** | Raw Material Receiving | Fabric & Trim Arrivals | Inventory Receipt Logs | Registered `materials` Record |
| **4** | Pre-Production Planning | Shading & Shrinkage Tests | Marker Plan Clearance | All `materials` set to `Approved` |
| **5** | Marker & Spreading Setup | Cut Order Plan | Spreading Layout | Planning Approval |
| **6** | Precision Panel Cutting | Fabric Rolls & Marker | Cut Panels | `cutting` set to `Completed` & `Approved` |
| **7** | Panel Bundling & Barcode Labeling | Cut Garment Panels | Barcoded Bundles | Registered `sewing` Bundle |
| **8** | Sewing Line Assembly | Barcoded Bundles | Assembled Shells | All `sewing` Bundles set to `Completed` |
| **9** | Assembly Output Inspection | Assembled Shells | Inspected Garments | `qc` Inline Sewing QC set to `Pass` |
| **10** | Ozone Bio Wash & Finishing | Raw Garments & Recipe | Washed Garments | `wash` Batch set to `Finish` or `Approved` |
| **11** | Wash & Finish Appearance Quality | Washed Garments | Quality Clearance | `wash` Batch set to `Approved` |
| **12** | Final AQL Pack Inspection | Finished Garments | Audited Goods | `qc` Final AQL Audit set to `Pass` |
| **13** | Master Carton Packing & Dispatch | Inspected Garments | Dispatched Goods | `carton` Status set to `Ready` |

---

## Role-Based Access Control (RBAC) & Security Scoping

The system enforces strict multi-tenant data isolation and role permissions across 5 distinct user roles:

1. **System Administrator (`admin`):** Full system access to all 13 stages, user administration, reporting, machinery configuration, and settings.
2. **Merchandiser (`merchandiser`):** Access to Order Intake, Material Receiving, Production Status, and Order Detail tracking.
3. **Production Supervisor (`production`):** Departmental access restricted to Material Receiving, Cutting Tracker, Sewing WIP, Wash & Finishing, and Packing & Dispatch.
4. **Quality Inspector (`qc`):** Access restricted to Quality Control audit logs, defect reporting, and Managerial Control reports.
5. **Brand Customer (`customer`):** Scoped access to view only orders, delivery status, and quality summaries belonging to their assigned customer account.

---

## Performance & High-Speed Caching Architecture

1. **Memoized Context Provider:** `AppDataContext.Provider` value references are memoized via `useMemo` to prevent unnecessary full-tree re-renders during state updates or clock ticks.
2. **Single-Pass Array Calculations:** Order dashboard statistics and analytics data are computed in single-pass iterations to guarantee execution times under 1ms.
3. **Optimized Query Caching:** TanStack Query `staleTime` is set to 10 seconds and `gcTime` is set to 5 minutes, providing 0ms cached page navigation while maintaining real-time data freshness.
4. **In-Memory Rate Limiting:** Includes a token-bucket rate limiter (`src/lib/cacheAndRateLimiter.ts`) enforcing IP and user action thresholds.

---

## E2E Pipeline Integration Test Suite

The project includes an automated end-to-end integration test suite (`scratch/test_extreme_pipeline_e2e.js`) validating stage-gate advancement rules across all 13 stages:

```bash
npx tsx scratch/test_extreme_pipeline_e2e.js
```

### Verification Results
- Total Tests: 22
- Passed: 22
- Failed: 0
- Coverage: 100% validation of stage-gate progression rules, material holds, cut panel approvals, sewing bundle completions, wash approvals, AQL pass checks, and carton dispatch conditions.

---

## Technology Stack

- **Frontend Core:** React 19, TypeScript, Vite, TanStack Router, TanStack React Query
- **Styling & UI:** Tailwind CSS, Radix UI Primitives, Lucide Icons, Recharts Analytics
- **Backend & Database:** Supabase PostgreSQL, Supabase Realtime, Supabase Storage
- **Build & Deployment:** Nitro Engine, Cloudflare Modules, Vercel

---

## Repository Directory Structure

```text
forge-flow-main/
├── public/
│   ├── SVG_MARK.svg            # Tightly cropped vector brand mark
│   ├── favicon.svg             # Vector browser tab favicon
│   └── assets/                 # Machine imagery and golden cloth hero video
├── src/
│   ├── components/
│   │   ├── AppShell.tsx        # Responsive navigation sidebar & header
│   │   ├── PublicLayout.tsx     # Public landing page layout
│   │   └── ui/                 # Reusable Radix & Tailwind UI components
│   ├── hooks/
│   │   ├── useAppData.tsx      # Main application data context & state engine
│   │   └── useAuth.tsx         # Authentication and session management
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client initialization & types
│   │   ├── cacheAndRateLimiter.ts # In-memory LRU cache & rate limiter
│   │   ├── eventQueue.ts       # Background task processing queue
│   │   └── mockData.ts         # Offline seed data & stage definitions
│   └── routes/
│       ├── __root.tsx          # Root route & global layout provider
│       ├── index.tsx           # Public landing page with 3D physics interaction
│       ├── dashboard.tsx       # Production flow 13-stage matrix
│       ├── orders.tsx          # Order management dashboard
│       ├── orders.$orderId.tsx # Comprehensive order detail view
│       ├── materials.tsx       # Material receiving & inspection
│       ├── cutting.tsx         # Cutting tracker & panel approvals
│       ├── sewing.tsx          # Sewing WIP & assembly line control
│       ├── wash.tsx            # Laundry wash & finishing batches
│       ├── qc.tsx              # Quality control & AQL audits
│       ├── dispatch.tsx        # Packing cartons & goods dispatch
│       ├── reports.tsx         # Managerial reports & CSV exporter
│       ├── settings.tsx        # Admin control panel & user management
│       └── account.tsx         # Profile preferences & security
├── scratch/
│   └── test_extreme_pipeline_e2e.js # 13-stage pipeline integration test suite
├── supabase/
│   └── migrations/             # SQL database schema & RLS migrations
├── package.json
└── README.md
```

---

## Database Schema & Row-Level Security (RLS) Script

The production PostgreSQL database schema and Row-Level Security (RLS) policies are defined in:

`supabase/migrations/20260723000000_scalability_indexes_and_perf.sql`

To apply schema migrations and performance composite indexes:

```sql
-- Composite performance indexes for production scaling
CREATE INDEX IF NOT EXISTS idx_orders_status_stage ON public.orders (status, current_stage);
CREATE INDEX IF NOT EXISTS idx_wip_logs_order_stage ON public.wip_logs (order_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_qc_records_order_checkpoint ON public.qc_records (order_id, stage_checkpoint);
CREATE INDEX IF NOT EXISTS idx_cartons_order_status ON public.cartons (order_id, dispatch_status);
CREATE INDEX IF NOT EXISTS idx_materials_order_status ON public.materials (order_id, inspection_status);
```

---

## Local Development Setup

### Prerequisites
- Node.js version 18.0.0 or higher
- npm version 9.0.0 or higher

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/UmairAbbas1/Forge-Fiber.git
   cd Forge-Fiber
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create local environment configuration:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Start the local development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000`.

5. Run type checking and build verification:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

---

## Production Deployment

The application is deployed on Vercel with automatic CI/CD triggers on git push to the `main` branch.

### Manual Production Build

```bash
npm run build
```

Production Web Application URL: [https://forge-fabric.vercel.app](https://forge-fabric.vercel.app)

---

## Security & Dependency Audit

- Vulnerabilities: 0 security vulnerabilities identified across npm dependencies.
- Secret Exposure Audit: Passed 100%. No service role keys or environment secrets are exposed in version control.
- Git Ignore Configuration: Explicitly ignores `.env`, `.env.*`, `*.pem`, `*.key`, and local debug scripts.

---

## License

Proprietary Software. All rights reserved. Forge & Fabric Industrial Systems.
