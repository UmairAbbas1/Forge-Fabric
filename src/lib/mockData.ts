// Mock data for Forge & Fabric Industries, Inc. production tracker
export type OrderStatus = "Open" | "In Production" | "On Hold" | "Shipped";
export type QCResult = "Pass" | "Rework" | "Reject";

export interface Order {
  order_id: string;
  customer_name: string;
  customer_id?: string;
  PO_number: string;
  tech_pack_ref: string;
  size_breakdown: string;
  status: OrderStatus;
  created_date: string;
  current_stage: number;
  qty: number;
  notes?: string;
  style_no?: string;
  style_description?: string;
  color?: string;
  planned_ship_date?: string;
  material_status?: string;
  delivered_qty?: number;
  open_balance?: number;
  delivery_status?: string;
}

export interface Material {
  material_id: string;
  order_id: string;
  type: "Fabric" | "Trim" | "Accessory";
  description: string;
  qty_received: number;
  inspection_status: "Pending" | "Approved" | "Hold";
  received_date: string;
}

export interface CuttingRecord {
  cut_id: string;
  order_id: string;
  panels_cut: number;
  size: string;
  color: string;
  cutter_used: string;
  status: "In Progress" | "Completed";
  first_cut_approval_status: "Pending" | "Approved" | "Rejected";
}

export interface SewingBundle {
  bundle_id: string;
  order_id: string;
  line_number: number;
  operator_count: number;
  status: "Active" | "Completed";
  inline_qc_result: QCResult;
  qty: number;
}

export interface WashBatch {
  batch_id: string;
  order_id: string;
  pcs_qty: number;
  stage: "Wash" | "Dry" | "Finish" | "Approved";
  equipment_used: string;
}

export interface QCRecord {
  qc_id: string;
  order_id: string;
  stage_checkpoint:
    | "Material Check"
    | "First Cut Approval"
    | "Inline Sewing QC"
    | "Wash-Finish Approval"
    | "Final AQL-Packing Audit";
  result: QCResult;
  inspected_qty: number;
  pass_qty: number;
  reject_qty: number;
  inspected_date: string;
}

export interface Carton {
  carton_id: string;
  order_id: string;
  packed_qty: number;
  dispatch_status: "Ready" | "Shipped";
  pod_reference: string;
  ship_date: string;
  carrier?: string;
  customer_acceptance?: "Pending" | "Accepted" | "Rejected" | "Claims / Review";
  invoice_ref?: string;
  remarks?: string;
}

export type WIPMovementType = "IN" | "OUT" | "REWORK" | "REJECT" | "HOLD" | "ADJUSTMENT";
export type WIPQCStatus = "Not Checked" | "Pass" | "Rework" | "Reject" | "Hold" | "Customer Review";

export interface WIPLog {
  log_id: string;
  order_id: string;
  stage_id: number;
  movement_type: WIPMovementType;
  qty_in: number;
  qty_out: number;
  rework_qty: number;
  reject_qty: number;
  net_wip_impact: number;
  qc_status: WIPQCStatus;
  operator?: string;
  batch_lot?: string;
  remarks?: string;
  updated_by?: string;
  log_date: string;
}

export const STAGES = [
  { id: 1, name: "Customer Order Intake", icon: "ClipboardList", input: "PO, tech pack, size breakdown", output: "Internal job card" },
  { id: 2, name: "Raw Material Receiving", icon: "PackageOpen", input: "Customer fabric, trims, accessories", output: "Received inventory log" },
  { id: 3, name: "Fabric & Trim Inspection", icon: "SearchCheck", input: "Received materials", output: "Approved / hold materials" },
  { id: 4, name: "Pre-Production Planning", icon: "ClipboardCheck", input: "Approved order + materials", output: "Production plan & routing" },
  { id: 5, name: "Pattern / Marker / Cutting", icon: "Scissors", input: "Pattern, marker, fabric", output: "Cut panels by size/color", equipment: "40 ft cutter" },
  { id: 6, name: "Bundling & Line Feeding", icon: "Boxes", input: "Cut panels", output: "Bundles to sewing line" },
  { id: 7, name: "Sewing Production", icon: "Cog", input: "Bundles, thread, trims", output: "Stitched garments", equipment: "72 industrial sewing machines" },
  { id: 8, name: "Pre-Wash QC", icon: "ShieldCheck", input: "Stitched garments", output: "Approved for finishing / repair" },
  { id: 9, name: "Laundry / Wash / Dry", icon: "Droplets", input: "Stitched garments", output: "Washed garments", equipment: "Industrial washers, dryers, boilers, destoner" },
  { id: 10, name: "Laser / Ozone / Spray / 3D Finish", icon: "Sparkles", input: "Washed garments", output: "Specialty-finished garments", equipment: "Jeanologia lasers, ozone, spray booth, 3D wrinkle" },
  { id: 11, name: "Final Quality Inspection", icon: "BadgeCheck", input: "Finished garments", output: "Pass / rework / reject" },
  { id: 12, name: "Pressing / Tagging / Packing", icon: "Tag", input: "Approved garments", output: "Packed cartons", equipment: "Tacker / tagging equipment" },
  { id: 13, name: "Finished Goods Dispatch", icon: "Truck", input: "Packed cartons", output: "Shipped order / POD" },
] as const;

export const QC_CHECKPOINTS = [
  { after_stage: 3, name: "Material Check" },
  { after_stage: 5, name: "First Cut Approval" },
  { after_stage: 7, name: "Inline Sewing QC" },
  { after_stage: 10, name: "Wash/Finish Approval" },
  { after_stage: 12, name: "Final AQL / Packing Audit" },
] as const;

// ---------------- Seeded RNG for stable mock data ----------------
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const range = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

const CUSTOMERS = [
  "Levi Strauss & Co.",
  "H&M Group",
  "Uniqlo Global",
  "Zara Denim",
  "Gap Inc.",
  "Diesel S.p.A.",
  "Nudie Jeans",
  "Wrangler",
  "Lee Cooper",
  "Pepe Jeans",
  "American Eagle",
  "Everlane",
];
const SIZES = ["28-38", "30-40", "S-XXL", "26-36", "XS-XL"];
const COLORS = ["Indigo Rinse", "Vintage Blue", "Jet Black", "Ecru", "Stone Wash", "Mid Blue"];
const CUTTERS = ["40 ft Auto Cutter A", "40 ft Auto Cutter B", "Manual Cut Table 1"];

function dateDaysAgo(d: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

// Orders
export const ORDERS: Order[] = Array.from({ length: 42 }, (_, i) => {
  const stage = range(1, 13);
  const status: OrderStatus =
    stage === 13 ? (rnd() > 0.4 ? "Shipped" : "In Production")
    : rnd() > 0.9 ? "On Hold"
    : rnd() > 0.75 ? "Open"
    : "In Production";
  const qtyVal = range(500, 5000);
  const delVal = status === "Shipped" ? qtyVal : (stage === 13 ? range(100, qtyVal) : 0);
  return {
    order_id: `FF-${(2600 + i).toString()}`,
    customer_name: pick(CUSTOMERS),
    PO_number: `PO-${10000 + i}`,
    tech_pack_ref: `TP-${1000 + i}`,
    size_breakdown: pick(SIZES),
    status,
    created_date: dateDaysAgo(range(1, 60)),
    current_stage: stage,
    qty: qtyVal,
    notes: "Initial order specifications uploaded and verified.",
    style_no: `STL-${range(100, 999)}`,
    style_description: `5-Pocket Denim ${pick(COLORS)}`,
    color: pick(COLORS),
    planned_ship_date: dateDaysAgo(range(-30, -5)),
    material_status: stage >= 3 ? "Approved" : "Pending",
    delivered_qty: delVal,
    open_balance: qtyVal - delVal,
    delivery_status: status === "Shipped" ? "Delivered" : (stage >= 12 ? "Ready to Ship" : "Open"),
  };
});

export const MOCK_WIP_LOGS: WIPLog[] = ORDERS.slice(0, 15).map((o, idx) => ({
  log_id: `LOG-${1000 + idx}`,
  order_id: o.order_id,
  stage_id: o.current_stage,
  movement_type: "IN",
  qty_in: o.qty,
  qty_out: Math.floor(o.qty * 0.95),
  rework_qty: Math.floor(o.qty * 0.03),
  reject_qty: Math.floor(o.qty * 0.02),
  net_wip_impact: o.qty,
  qc_status: "Pass",
  operator: `Line ${((idx % 5) + 1)} Manager`,
  batch_lot: `LOT-2026-${100 + idx}`,
  remarks: "Normal stage movement log",
  updated_by: "prod@forgefabric.com",
  log_date: o.created_date,
}));

export const MATERIALS: Material[] = ORDERS.flatMap((o) =>
  Array.from({ length: range(2, 4) }, (_, j) => ({
    material_id: `MAT-${o.order_id}-${j}`,
    order_id: o.order_id,
    type: pick(["Fabric", "Trim", "Accessory"] as const),
    description: pick(["12oz Denim", "YKK Zipper", "Cotton Thread", "Leather Patch", "Rivet Set", "Woven Label"]),
    qty_received: range(50, 2000),
    inspection_status: pick(["Pending", "Approved", "Approved", "Approved", "Hold"] as const),
    received_date: dateDaysAgo(range(0, 15)),
  }))
);

export const CUTTING: CuttingRecord[] = ORDERS.filter((o) => o.current_stage >= 5).map((o, i) => ({
  cut_id: `CUT-${o.order_id}`,
  order_id: o.order_id,
  panels_cut: range(200, o.qty),
  size: o.size_breakdown,
  color: pick(COLORS),
  cutter_used: pick(CUTTERS),
  status: o.current_stage > 5 ? "Completed" : (i % 2 === 0 ? "In Progress" : "Completed"),
  first_cut_approval_status: o.current_stage > 5 ? "Approved" : pick(["Pending", "Approved"] as const),
}));

export const SEWING: SewingBundle[] = ORDERS.filter((o) => o.current_stage >= 6 && o.current_stage <= 8)
  .flatMap((o) =>
    Array.from({ length: range(2, 5) }, (_, k) => ({
      bundle_id: `BND-${o.order_id}-${k}`,
      order_id: o.order_id,
      line_number: range(1, 12),
      operator_count: range(6, 14),
      status: rnd() > 0.5 ? "Active" : "Completed" as const,
      inline_qc_result: pick(["Pass", "Pass", "Pass", "Pass", "Rework", "Reject"] as const),
      qty: range(40, 240),
    }))
  );

export const WASH: WashBatch[] = ORDERS.filter((o) => o.current_stage >= 9 && o.current_stage <= 11).map((o) => ({
  batch_id: `WSH-${o.order_id}`,
  order_id: o.order_id,
  pcs_qty: range(200, o.qty),
  stage: pick(["Wash", "Dry", "Finish", "Approved"] as const),
  equipment_used: pick(["Industrial Washer #3", "Jeanologia Laser", "Ozone Booth", "Spray Booth", "3D Wrinkle"]),
}));

export const QC: QCRecord[] = Array.from({ length: 60 }, (_, i) => {
  const o = pick(ORDERS);
  const inspected = range(80, 500);
  const rejectRate = rnd() * 0.08;
  const reject = Math.floor(inspected * rejectRate);
  const pass = inspected - reject;
  const result: QCResult = reject / inspected > 0.05 ? "Reject" : reject > 0 ? "Rework" : "Pass";
  return {
    qc_id: `QC-${1000 + i}`,
    order_id: o.order_id,
    stage_checkpoint: pick([
      "Material Check",
      "First Cut Approval",
      "Inline Sewing QC",
      "Wash-Finish Approval",
      "Final AQL-Packing Audit",
    ] as const),
    result,
    inspected_qty: inspected,
    pass_qty: pass,
    reject_qty: reject,
    inspected_date: dateDaysAgo(range(0, 10)),
  };
});

export const CARTONS: Carton[] = ORDERS.filter((o) => o.current_stage >= 12).map((o, i) => ({
  carton_id: `CTN-${5000 + i}`,
  order_id: o.order_id,
  packed_qty: range(40, 120),
  dispatch_status: o.status === "Shipped" ? "Shipped" : pick(["Ready", "Ready", "Shipped"] as const),
  pod_reference: o.status === "Shipped" ? `POD-${range(70000, 99999)}` : "",
  ship_date: o.status === "Shipped" ? dateDaysAgo(range(0, 20)) : "",
}));

// Trend data for order overview
export const ORDER_TREND = Array.from({ length: 14 }, (_, i) => ({
  day: `D-${13 - i}`,
  orders: range(4, 18),
  completed: range(2, 12),
}));
