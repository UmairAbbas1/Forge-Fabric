import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Canonical apparel size order for sorting
const APPAREL_SIZE_ORDER: Record<string, number> = {
  XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, "2XL": 6, XXXL: 7, "3XL": 7,
  "4XL": 8, "5XL": 9, "6XL": 10,
};

/**
 * Compares two size labels for sorting.
 * Numeric sizes (waist 28, 30, 32…) sort by value.
 * Apparel sizes (XS, S, M, L, XL…) sort by canonical order.
 */
function compareSizes(a: string, b: string): number {
  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  const aIsNum = !isNaN(aNum);
  const bIsNum = !isNaN(bNum);

  if (aIsNum && bIsNum) return aNum - bNum;

  const aOrd = APPAREL_SIZE_ORDER[a.toUpperCase()];
  const bOrd = APPAREL_SIZE_ORDER[b.toUpperCase()];
  if (aOrd !== undefined && bOrd !== undefined) return aOrd - bOrd;

  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  return a.localeCompare(b);
}

/**
 * Normalises a size_breakdown string for clean display.
 *
 * Rules:
 *  - "28:100, 30:250, 32:350"  → sort by size, keep size:qty format, join with ", "
 *  - "28-38" / "S-XXL"         → two-part range, returned as-is (it's a range, not a list)
 *  - "29-30-31-32-34"          → sort numerically, join with ", " (NOT dashes — prevents bad wrapping)
 *  - "S, M, L, XL"            → sort by apparel order, join with ", "
 */
export function formatSizeBreakdown(raw: string | null | undefined): string {
  if (!raw) return "";
  const str = raw.trim();

  // Format: "28:100, 30:250" — size:qty pairs (has colon)
  if (str.includes(":")) {
    const pairs = str.split(",").map((p) => p.trim()).filter(Boolean);
    const parsed = pairs
      .map((p) => {
        const [size, qty] = p.split(":").map((s) => s.trim());
        return { size, qty: qty ?? "" };
      })
      .filter((p) => p.size);

    parsed.sort((a, b) => compareSizes(a.size, b.size));
    return parsed.map((p) => (p.qty ? `${p.size}:${p.qty}` : p.size)).join(", ");
  }

  // Split on dashes to detect range vs list
  const dashParts = str.split("-").map((s) => s.trim()).filter(Boolean);

  // Two-part range like "28-38" or "S-XXL" — keep as-is
  if (dashParts.length === 2) {
    return str;
  }

  // Multi-size dash list like "29-30-31-32-34" — sort and join with ", " for clean wrapping
  if (dashParts.length >= 3) {
    const sorted = [...dashParts].sort(compareSizes);
    return sorted.join(", ");
  }

  // Comma-separated list like "S, M, L, XL" — sort and rejoin
  if (str.includes(",")) {
    const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
    const sorted = [...parts].sort(compareSizes);
    return sorted.join(", ");
  }

  // Single size or unrecognised format — return as-is
  return str;
}

/**
 * Sorts the keys of a size object (Record<string, number>) in canonical order.
 * Use this when building size_breakdown strings from objects at write-time.
 */
export function sortedSizeKeys(sizeObj: Record<string, number>): string[] {
  return Object.keys(sizeObj).sort(compareSizes);
}

/**
 * Parses a size_breakdown string into a genuine { size: qty } map.
 *
 * Only the colon-delimited "28:100, 30:250" format carries real per-size
 * quantity data. Range labels ("28-38"), bare lists ("29-30-31-32-34",
 * "S, M, L, XL"), and placeholders ("Standard Matrix") carry NO quantity
 * information — returns null for those rather than fabricating numbers.
 * Callers needing a real size:qty split (e.g. batch/work-order creation)
 * must handle the null case explicitly (manual entry, or block the action)
 * instead of guessing.
 */
export function parseSizeBreakdown(raw: string | null | undefined): Record<string, number> | null {
  if (!raw) return null;
  const str = raw.trim();
  if (!str.includes(":")) return null;

  const pairs = str.split(",").map((p) => p.trim()).filter(Boolean);
  const result: Record<string, number> = {};

  for (const p of pairs) {
    const [size, qtyRaw] = p.split(":").map((s) => s.trim());
    const qty = Number(qtyRaw);
    if (!size || !qtyRaw || Number.isNaN(qty)) return null; // malformed pair — don't return a partial/misleading map
    result[size] = qty;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/** Serializes a { size: qty } map back into the canonical "size:qty, size:qty" storage format. */
export function serializeSizeBreakdown(sizeMap: Record<string, number>): string {
  return sortedSizeKeys(sizeMap)
    .map((size) => `${size}:${sizeMap[size]}`)
    .join(", ");
}

/**
 * REQ-14: Client-side mirror of the DB's get_next_selected_stage() function
 * (see supabase/migrations/20260825000000_selective_pipeline_and_enhanced_outsourcing.sql).
 * Given an order's selected_stages pipeline and its current stage, returns
 * the next stage in that pipeline — skipping any stage the order's
 * selective pipeline doesn't include — or null if already at the last
 * selected stage. Falls back to a plain +1 when selectedStages is missing
 * (legacy orders backfilled to the full 13-stage default never hit this
 * path, but any order fetched before that backfill applies would).
 */
export function getNextSelectedStage(
  currentStage: number,
  selectedStages: number[] | null | undefined
): number | null {
  if (!selectedStages || selectedStages.length === 0) {
    return currentStage + 1 <= 13 ? currentStage + 1 : null;
  }
  const idx = selectedStages.indexOf(currentStage);
  if (idx === -1 || idx === selectedStages.length - 1) return null;
  return selectedStages[idx + 1];
}

/**
 * REQ-09: Capacity-Based Dynamic Delivery Date Scheduling Engine.
 * Earliest Ship Date = Today + ceil((Active Backlog + New Order Units) / Daily Capacity) + Laundry Buffer.
 */
export function calculateSuggestedShipDate(
  newOrderUnits: number,
  activeBacklogUnits: number,
  dailyCapacityUnits: number = 144_000,
  laundryBufferDays: number = 2,
  fromDate: Date = new Date(),
  // Rush priority shaves this many days off the standard buffered total —
  // but never below productionDays, the real time needed to actually
  // produce the units. Materials still have to be cut, sewn, and washed;
  // rush shortens the buffer/queue time, not physics.
  rushLeadTimeReductionDays: number = 0
): { suggestedDate: Date; productionDays: number; totalDays: number } {
  const safeCapacity = Math.max(1, dailyCapacityUnits);
  const productionDays = Math.max(1, Math.ceil((Math.max(0, activeBacklogUnits) + Math.max(0, newOrderUnits)) / safeCapacity));
  const bufferedDays = productionDays + Math.max(0, laundryBufferDays);
  const totalDays = Math.max(productionDays, bufferedDays - Math.max(0, rushLeadTimeReductionDays));
  const suggestedDate = new Date(fromDate);
  suggestedDate.setDate(suggestedDate.getDate() + totalDays);
  return { suggestedDate, productionDays, totalDays };
}

/**
 * Shared eligibility check for "which real POs should I offer to log
 * incoming material against" (materials.tsx, inventory.tsx, sku-mapping.tsx
 * Goods Receipt Note dropdowns). A PO is ineligible once it's already
 * complete (Shipped / purchase_orders Completed), was never approved
 * (rejected / customer_rejected / purchase_orders Cancelled), or is a
 * `converted` apply_submissions row — those are excluded on purpose, not
 * overlooked: a converted submission's real order (if it still exists)
 * already appears via the 'order' source with its own live status and PO
 * number, so the submission's own entry is always either redundant or,
 * if that order was since hard-deleted, a phantom reference to nothing —
 * this is the actual root cause of "deleted" POs still showing up (see
 * useAppData.tsx's deleteOrder/deleteCustomerCascade: orders are hard
 * DELETEd, not soft-deleted, and never cascade to apply_submissions).
 * Every other status (Open, In Production, On Hold, pending/under
 * review, needs_info, approved, pending_customer_review, purchase_orders
 * Draft/Submitted/Approved/In_Production/CHANGE_PENDING) stays eligible.
 */
export type PoEligibilitySource = "order" | "submission" | "purchase_order";

export function isPoEligibleForReceiving(status: string | null | undefined, source: PoEligibilitySource): boolean {
  const s = (status || "").trim();
  switch (source) {
    case "order":
      return s !== "Shipped";
    case "submission":
      return s !== "rejected" && s !== "customer_rejected" && s !== "converted";
    case "purchase_order":
      return s !== "Completed" && s !== "Cancelled";
    default:
      return true;
  }
}
