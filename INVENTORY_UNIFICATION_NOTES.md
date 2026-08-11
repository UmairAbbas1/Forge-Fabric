# Inventory Unification Architecture & Audit Notes

## 1. Executive Summary & Root Cause Audit (Gap P5)

During the repo audit of "Forge & Fabric", two parallel, disconnected inventory systems were identified:

1. **`src/routes/materials.tsx` (Legacy Raw Materials Intake)**:
   - Written around `raw_materials_intake` table.
   - Handled receiving roll-level fabric intake and 4-point inspection statuses (`Pending`, `Approved`, `Hold`).
   - Hardcoded facility filters to two fixed locations (`Main Factory`, `Laundry Unit`).
   - **Gap**: Disconnected from actual shop-floor work order consumption and cutting lot allocations.

2. **`src/routes/inventory.tsx` (Legacy Dashboard)**:
   - Read from `inventory_items` and mock arrays.
   - Summarized fabric vs. finished goods based on hardcoded stage numbers (`Stage >= 12`).
   - **Gap**: Did not reflect real-time bin/lot tracking or `available_qty = quantity_on_hand - allocated_qty` accounting principles defined in Section 6.1 of `ARCHITECTURE_BLUEPRINT.md`.

## 2. Unified Database Schema (`inventory_items` + `inventory_lots` + `inventory_issuances`)

To resolve this divergence without data loss:

*   **`inventory_items`**: Serves as the Master SKU Catalog for raw fabric, trims, packaging, thread, and laundry chemicals.
*   **`inventory_lots`**: Represents transactional physical stock in specific facilities and bins.
    *   Tracks `lot_number`, `facility_id`, `supplier_id` (foreign key to `companies` where `company_type = 'Vendor'`), `quantity_on_hand`, `allocated_qty`, and generated `available_qty`.
    *   Preserves the 4-point inspection status model (`inspection_status` $\in$ `'Pending'`, `'Approved'`, `'Hold'`).
*   **`inventory_issuances`**: Audit log recording every consumption event (e.g. Cut Ticket execution or Wash batch chemical draw). Decrements `available_qty` atomically.

## 3. Migration & Routing Strategy

*   **Redirect `src/routes/materials.tsx`**: Updated to automatically navigate users to `/inventory` with tab indicators (`?tab=fabric`), preserving existing bookmarks and navigation links.
*   **Unified Route (`src/routes/inventory.tsx`)**: Rebuilt as the single source of truth for all inventory management, facility filtering, GRN receipt, 4-point inspection grading, and stock issuance logging.
