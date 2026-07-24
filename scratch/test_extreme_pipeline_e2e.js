/**
 * Extreme Garment Production Pipeline E2E Unit Test Suite
 * Tests 13-Stage Stage Advancement Rules & Data Pipeline Integrations
 */

import { checkStageAdvancement } from "../src/hooks/useAppData.tsx";

console.log("=========================================================================");
console.log("⚡ STARTING EXTREME GARMENT PRODUCTION PIPELINE E2E TEST SUITE");
console.log("=========================================================================\n");

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
  }
}

const mockOrderId = "FF-TEST-9999";
const mockData = {
  materials: [],
  cutting: [],
  sewing: [],
  qc: [],
  wash: [],
  cartons: []
};

// --- STAGE 2: Raw Material Sourcing ---
console.log("📌 Testing Stage 2 Advancement (Raw Material Sourcing)...");
let res2 = checkStageAdvancement(2, mockOrderId, mockData);
assert(res2.allowed === true, "Stage 2 allowed without material records");

// --- STAGE 3: Material Inspection ---
console.log("\n📌 Testing Stage 3 Advancement (Material Inspection Sign-Off)...");
let res3_blocked = checkStageAdvancement(3, mockOrderId, mockData);
assert(res3_blocked.allowed === false, "Stage 3 blocked when no material records exist");

mockData.materials.push({
  material_id: "MAT-99",
  order_id: mockOrderId,
  type: "Fabric",
  description: "100% Cotton Denim",
  inspection_status: "Pending",
  received_qty: 500,
});

let res3_allowed = checkStageAdvancement(3, mockOrderId, mockData);
assert(res3_allowed.allowed === true, "Stage 3 allowed after material record registered");

// --- STAGE 4: Pre-Production Planning ---
console.log("\n📌 Testing Stage 4 Advancement (Pre-Production Planning)...");
let res4_blocked = checkStageAdvancement(4, mockOrderId, mockData);
assert(res4_blocked.allowed === false, "Stage 4 blocked when materials are Pending or Hold");

mockData.materials[0].inspection_status = "Approved";
let res4_allowed = checkStageAdvancement(4, mockOrderId, mockData);
assert(res4_allowed.allowed === true, "Stage 4 allowed once materials are Approved");

// --- STAGE 5: Marker & Spreading ---
console.log("\n📌 Testing Stage 5 Advancement (Marker & Spreading Setup)...");
let res5 = checkStageAdvancement(5, mockOrderId, mockData);
assert(res5.allowed === true, "Stage 5 allowed after planning sign-off");

// --- STAGE 6: Precision Cutting ---
console.log("\n📌 Testing Stage 6 Advancement (Precision Spreading & Cutting)...");
let res6_blocked = checkStageAdvancement(6, mockOrderId, mockData);
assert(res6_blocked.allowed === false, "Stage 6 blocked when no Approved cutting record exists");

mockData.cutting.push({
  cutting_id: "CUT-99",
  order_id: mockOrderId,
  status: "Completed",
  first_cut_approval_status: "Approved",
  panels_cut: 1000,
});

let res6_allowed = checkStageAdvancement(6, mockOrderId, mockData);
assert(res6_allowed.allowed === true, "Stage 6 allowed with Completed & Approved cut panels");

// --- STAGE 7: Panel Bundling ---
console.log("\n📌 Testing Stage 7 Advancement (Panel Bundling & Barcode Labeling)...");
let res7_blocked = checkStageAdvancement(7, mockOrderId, mockData);
assert(res7_blocked.allowed === false, "Stage 7 blocked when no sewing bundles registered");

mockData.sewing.push({
  bundle_id: "BUN-99",
  order_id: mockOrderId,
  status: "In Progress",
  qty: 250,
});

let res7_allowed = checkStageAdvancement(7, mockOrderId, mockData);
assert(res7_allowed.allowed === true, "Stage 7 allowed after sewing bundle registered");

// --- STAGE 8: Sewing Line Assembly ---
console.log("\n📌 Testing Stage 8 Advancement (Sewing Line Assembly Completion)...");
let res8_blocked = checkStageAdvancement(8, mockOrderId, mockData);
assert(res8_blocked.allowed === false, "Stage 8 blocked while sewing bundle is In Progress");

mockData.sewing[0].status = "Completed";
let res8_allowed = checkStageAdvancement(8, mockOrderId, mockData);
assert(res8_allowed.allowed === true, "Stage 8 allowed when all sewing bundles Completed");

// --- STAGE 9: Assembly Line Output Inspection ---
console.log("\n📌 Testing Stage 9 Advancement (Assembly Line Output Inspection)...");
let res9_blocked = checkStageAdvancement(9, mockOrderId, mockData);
assert(res9_blocked.allowed === false, "Stage 9 blocked without Inline Sewing QC record");

mockData.qc.push({
  qc_id: "QC-99",
  order_id: mockOrderId,
  stage_checkpoint: "Inline Sewing QC",
  result: "Pass",
  inspected_qty: 250,
  pass_qty: 245,
  reject_qty: 5,
});

let res9_allowed = checkStageAdvancement(9, mockOrderId, mockData);
assert(res9_allowed.allowed === true, "Stage 9 allowed after Inline Sewing QC Pass");

// --- STAGE 10: Ozone Bio Wash ---
console.log("\n📌 Testing Stage 10 Advancement (Ozone Bio Wash & Finishing)...");
let res10_blocked = checkStageAdvancement(10, mockOrderId, mockData);
assert(res10_blocked.allowed === false, "Stage 10 blocked without Wash batch in Finish/Approved");

mockData.wash.push({
  batch_id: "WASH-99",
  order_id: mockOrderId,
  stage: "Finish",
  qty: 250,
});

let res10_allowed = checkStageAdvancement(10, mockOrderId, mockData);
assert(res10_allowed.allowed === true, "Stage 10 allowed with Wash batch in Finish stage");

// --- STAGE 11: Wash & Finish Appearance Quality ---
console.log("\n📌 Testing Stage 11 Advancement (Wash & Finish Appearance Approval)...");
let res11_blocked = checkStageAdvancement(11, mockOrderId, mockData);
assert(res11_blocked.allowed === false, "Stage 11 blocked when Wash batch is not Approved");

mockData.wash[0].stage = "Approved";
let res11_allowed = checkStageAdvancement(11, mockOrderId, mockData);
assert(res11_allowed.allowed === true, "Stage 11 allowed after Wash batch Approved");

// --- STAGE 12: Final AQL Pack Inspection ---
console.log("\n📌 Testing Stage 12 Advancement (Final AQL Pack Inspection)...");
let res12_blocked = checkStageAdvancement(12, mockOrderId, mockData);
assert(res12_blocked.allowed === false, "Stage 12 blocked without Wash-Finish or Final AQL Pass record");

mockData.qc.push({
  qc_id: "QC-100",
  order_id: mockOrderId,
  stage_checkpoint: "Final AQL-Packing Audit",
  result: "Pass",
  inspected_qty: 250,
  pass_qty: 248,
  reject_qty: 2,
});

let res12_allowed = checkStageAdvancement(12, mockOrderId, mockData);
assert(res12_allowed.allowed === true, "Stage 12 allowed with Final AQL Audit Pass");

// --- STAGE 13: Master Carton Packing & Goods Dispatch ---
console.log("\n📌 Testing Stage 13 Advancement (Master Carton Packing & Goods Dispatch)...");
let res13_blocked = checkStageAdvancement(13, mockOrderId, mockData);
assert(res13_blocked.allowed === false, "Stage 13 blocked without Carton in Ready status");

mockData.cartons.push({
  carton_id: "CTN-99",
  order_id: mockOrderId,
  dispatch_status: "Ready",
  packed_qty: 250,
});

let res13_allowed = checkStageAdvancement(13, mockOrderId, mockData);
assert(res13_allowed.allowed === true, "Stage 13 allowed with Ready packing carton");

console.log("\n=========================================================================");
console.log(`📊 EXTREME PIPELINE E2E TEST SUMMARY:`);
console.log(`   Passed: ${passedTests} / ${passedTests + failedTests}`);
console.log(`   Failed: ${failedTests}`);
console.log("=========================================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
