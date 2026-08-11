# Classification Subforms Pattern

This document outlines the architectural pattern established during the "Sample Request" intake patch for conditional order classifications.

## Overview
Previously, the Forge & Fabric order intake wizard routed all four classifications (New Bulk Order, Sample Request, Rush Production, Order Update) to the same generic Blanket PO form (`OrderDetailsForm.tsx`). 

This architecture was refactored to allow each classification to have its own dedicated data schema, validation rules, and intake UI, while sharing common base components (like `AddressSelector.tsx` and the initial company setup).

## How to Add a New Subform

To replace one of the remaining stubs (Bulk Order, Rush Production, Order Update) with a functional intake flow:

### 1. Database Layer (Supabase)
- Create a new migration file in `supabase/migrations/` (e.g., `20261012000400_erp_rush_orders.sql`).
- Define the specific tables required for that classification.
- Implement an RPC function for atomic submission (e.g., `submit_rush_order`). This RPC must handle creating relationships (like addresses, line items) transactionally.
- *Do not overload `apply_submissions` JSON blobs if the data structure is distinct.*

### 2. Zod Validation Schema
- Create a schema in `src/lib/validation/` (e.g., `rushOrderSchema.ts`).
- Enforce strict limits matching the backend (e.g., Rush Order might require a `rush_fee_acknowledged: z.literal(true)`).

### 3. Build the Subform Component
- Create the form in `src/components/apply-portal/subforms/` (e.g., `RushOrderSubform.tsx`).
- Use `react-hook-form` and `@hookform/resolvers/zod`.
- Access the shared `companyInfo` state via `useApplyWizard()` context.
- Use `AddressSelector` for any shipping/billing addresses. Ensure you check for `company_id` existence, and create the company on-the-fly during submission if the user is a new brand.

### 4. Wire it into the Selector
- Open `src/components/apply-portal/CompanyInfoForm.tsx`.
- Replace the corresponding stub import with your new component.
- The `OrderClassificationSelector` will automatically manage the UI state.

### 5. Merchandiser Dashboard Update
- Update `src/components/merchandiser/SubmissionsDashboard.tsx`.
- If the new classification warrants its own tab and table (like `SampleRequestsDashboard.tsx`), create it and wire it to the `activeTab` state.
- Build the respective details side-panel (`RushOrderDetails.tsx`) to allow merchandisers to drive the state machine for that order type.

## Core Philosophies
- **Specialization over Generalization**: A sample request is structurally different from a bulk order. Do not try to merge them into one UI or one database table.
- **Atomic Submissions**: The subform should submit its payload entirely through an RPC function to avoid orphaned rows if the network fails halfway through.
- **Shared Master Data**: Always reuse `companies`, `address_book`, and `styles` tables. Do not duplicate master data entries.
