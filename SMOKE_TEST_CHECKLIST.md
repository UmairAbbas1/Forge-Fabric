# Forge & Fabric ERP/MES — End-to-End Smoke Test Checklist

**Target:** Enterprise QA & CEO Final Validation  
**Scope:** Golden Path Execution & CEO Bug Verifications  

---

## 1. Golden Path Smoke Test (Order Intake to Fulfillment)

### Phase A: User Provisioning & RBAC Setup
- [ ] **Step 1: Admin Invites Merchandiser**
  - Log in as `super_admin` or `admin`.
  - Navigate to **Settings $\rightarrow$ User Management** (`/settings/users`).
  - Click **Invite User**. Enter Email (`merch@factory.com`), Name (`Jane Merchandiser`), select Role `merchandiser`.
  - Verify modal submits and profile status shows **Invited**.
- [ ] **Step 2: Merchandiser Invites Customer**
  - Log in as `merchandiser`.
  - Navigate to **Settings $\rightarrow$ User Management**. Click **Invite User**. Select Role `customer`.
  - Verify **Company Selection dropdown appears and is REQUIRED**.
  - Attempt submit without selecting a company $\rightarrow$ Verify submit is **Hard Locked**.
  - Select active customer (`Levi Strauss & Co.`) and submit invite.

### Phase B: Order Intake & State-Machine Locking (CEO Bug #1 Verification)
- [ ] **Step 3: Public Order Submission (`/apply/new`)**
  - Access `/apply/new` as a customer or guest.
  - **Verification 1 (State-Machine Lock):** On Step 1 (Organization Details), attempt to click **Continue to Order Details** without selecting a customer company.
  - *Expected Result:* Button is **disabled and unclickable**.
  - Select an existing customer company. Verify primary address, contacts, and open PO count pre-fill in read-only mode.
  - Click **Continue to Order Details** $\rightarrow$ Step 2 advances cleanly.
- [ ] **Step 4: Generic Size Matrix Grid (CEO Bug #2 Verification)**
  - On Step 3 (Style & SKU) & Step 4 (Size Matrix), select a style.
  - **Verification 2 (Generic Size Columns):** Observe the `SizeMatrixGrid`.
  - *Expected Result:* Grid renders size columns dynamically matching that style's assigned `size_range` (e.g. numeric denim `28-40` or alpha `XS-XXL`). NO hardcoded size headers.
  - Enter size breakdown quantities and attach spec document.
  - Click **Submit Production Order** $\rightarrow$ Order created in `'Submitted'` status with reference code.

### Phase C: Merchandiser Conversion & Production Execution (Flow C & D)
- [ ] **Step 5: Submissions Review & PO Approval (`/submissions/$submissionId`)**
  - Log in as `merchandiser`. Navigate to **Submissions Inbox** (`/submissions`).
  - Open submission. Click **Approve PO & Convert to Work Orders**.
  - *Validation Check:* If style lacks approved BOM or size range, verify inline error alert displays with direct clickable link to `/boms` or `/size-ranges`.
  - Upon successful approval, verify system invokes `convert_po_to_work_orders` RPC and displays generated Work Orders.
- [ ] **Step 6: Cutting & Inventory Lot Allocation Gate (`/cutting`)**
  - Log in as `cutting_supervisor`. Navigate to **Cutting Shop Floor** (`/cutting`).
  - Click **Create Cut Ticket**. Select target Work Order and Fabric Lot from inventory.
  - **Verification 3 (Lot Availability Gate):** Enter required yards exceeding fabric lot's `available_qty`.
  - *Expected Result:* Modal displays red **INSUFFICIENT STOCK** alert and blocks creation.
  - Enter valid yards $\le$ `available_qty` and submit.
  - Click **Complete Cut & Issue Bundles**.
  - *Expected Result:* System auto-generates barcode bundle tags (`BND-XXXXX-30-01`) and logs an `inventory_issuances` row.
- [ ] **Step 7: Sewing Line Bundle Scanning (`/sewing`)**
  - Log in as `sewing_supervisor`. Navigate to **Sewing Line Tracking** (`/sewing`).
  - Scan or enter bundle barcode (`BND-501-RAW-30-01`) into station scanner.
  - Click **Scan Bundle into Operation**.
  - *Expected Result:* Bundle advances to selected operation, update recorded in `bundles`, and audit row created in `scan_events`.
- [ ] **Step 8: Quality Inspection & Customer Privacy Shield (`/qc`)**
  - Log in as `qc_inspector`. Navigate to **Quality Checkpoints** (`/qc`).
  - Enter bundle barcode, total inspected pcs, and failed defect pcs. Select defect code from taxonomy (`ST-01 Skipped Stitching`).
  - Submit inspection. Verify failed bundle routes to **Rework Queue**.
  - **Verification 4 (Customer Privacy Shield):** Log in as `customer` role and view `/qc`.
  - *Expected Result:* Customer Privacy Shield badge active. Internal operator names and machine IDs are **completely hidden**.
- [ ] **Step 9: Dispatch Logistics & PO Fulfillment (`/dispatch`)**
  - Log in as `warehouse`. Navigate to **Dispatch Logistics** (`/dispatch`).
  - Click **Create Packing List**. Select destination address from customer `address_book` master.
  - Click **Dispatch & Log Driver POD**. Enter driver name and POD signature reference.
  - Confirm dispatch.
  - *Expected Result:* Shipment status set to `Shipped`. Fulfillment status cascade marks Work Order and Purchase Order as **FULFILLED / CLOSED**.

---

## 2. White-Labeling & Branding Verification
- [ ] Log in as `admin` and navigate to **Settings $\rightarrow$ Tenant Branding** (`/settings/branding`).
- [ ] Modify Primary Color to `#047857` (Emerald Green) and submit.
- [ ] Verify CSS custom variables update immediately across app shell, action buttons, and public `/apply/new` portal.
