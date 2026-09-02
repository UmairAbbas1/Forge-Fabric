import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Coerces any field value into a genuinely displayable string. Guards
 * against a corrupted record — a raw object landing in what's supposed to
 * be a plain text column (customer_name, size_breakdown, PO_number, etc.),
 * from a bad manual DB edit or an old buggy write path — crashing the
 * WHOLE page with React's "Objects are not valid as a React child" the
 * instant that row is opened. Surfaces the bad value as visible JSON text
 * instead, so it's obvious what's wrong and can be typed over, rather than
 * silently blanking the page with no way to even see or fix the record.
 */
export function toSafeDisplayString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

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

/**
 * Extracts a real { size: qty } breakdown from an order's size_breakdown
 * field, whatever shape it happens to be stored in live — a genuine object
 * (written directly by ConversionModal.tsx as `size_breakdown: sizeMatrix`),
 * a JSON-stringified object, or the canonical "28:100, 30:250" delimited
 * string (parseSizeBreakdown above). Returns null — never a fabricated
 * distribution — when the field is a bare range/preset label ("28-38",
 * "S-XXL") that carries no real per-size quantity at all. Any caller that
 * needs a genuine size:qty split from an order (not just a cut ticket)
 * should go through this, not re-derive its own subset of these cases.
 */
export function extractOrderSizeBreakdown(raw: unknown): Record<string, number> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length > 0) {
    return { ...(raw as Record<string, number>) };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          return parsed;
        }
      } catch {
        // Not valid JSON despite the leading brace — fall through to the
        // colon-delimited parse below rather than giving up.
      }
    }
    return parseSizeBreakdown(trimmed);
  }
  return null;
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
 * Whether an order (or a ticket's parent order) is fully done — shipped,
 * not mid-production — and therefore safe to dismiss from an active-work
 * view. Single shared source of truth so every "remove completed tile"
 * button across cutting/sewing/wash/orders/dashboard checks the real order,
 * not the ticket's own local status (a Completed cut ticket on an order
 * still in Sewing must NOT be dismissable).
 */
export function isOrderFullyComplete(order: {
  status?: string | null;
  current_stage?: number | null;
  selected_stages?: number[] | null;
} | null | undefined): boolean {
  if (!order) return false;
  if (order.status === "Shipped") return true;
  if (order.status === "In Production" || order.status === "On Hold") return false;
  const stages = order.selected_stages;
  const lastStage = stages && stages.length > 0 ? Math.max(...stages) : 13;
  return (order.current_stage || 0) >= lastStage;
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
): { suggestedDate: Date; productionDays: number; totalDays: number; rushReductionFullyHonored: boolean } {
  const safeCapacity = Math.max(1, dailyCapacityUnits);
  const productionDays = Math.max(1, Math.ceil((Math.max(0, activeBacklogUnits) + Math.max(0, newOrderUnits)) / safeCapacity));
  const bufferedDays = productionDays + Math.max(0, laundryBufferDays);
  const rushReducedDays = bufferedDays - Math.max(0, rushLeadTimeReductionDays);
  const totalDays = Math.max(productionDays, rushReducedDays);
  const suggestedDate = new Date(fromDate);
  suggestedDate.setDate(suggestedDate.getDate() + totalDays);
  // False when the standard rush reduction was clamped away entirely by the
  // real production floor for this quantity/throughput — i.e. the blanket
  // "rush ships N days sooner" promise couldn't actually be honored here.
  return { suggestedDate, productionDays, totalDays, rushReductionFullyHonored: rushReducedDays >= productionDays };
}

/**
 * Pricing & Rates engine — Phase C: Rush Feasibility.
 *
 * Reuses calculateSuggestedShipDate() as-is, called twice — same formula,
 * same laundry-buffer+rush-reduction logic ConversionModal.tsx already uses
 * for its own generic capacity suggestion:
 *   1. genericDate: the whole-factory dailyCapacityUnits figure, against
 *      the REAL whole-factory backlog — what a rush order's turnaround
 *      generically implies, factory-wide.
 *   2. earliestAchievableDate: THIS order's own quantity against the
 *      article's real units_per_shift throughput (article_cycle_profiles)
 *      — backlog is deliberately passed as 0 here, not the whole-factory
 *      figure. That factory-wide backlog is overwhelmingly units of OTHER,
 *      unrelated garment types competing for entirely different lines; a
 *      79-unit T-shirt order queued behind 15,000 units of denim and
 *      hoodies it never actually shares a line with is not a real
 *      constraint on THIS order, and treating it as one made small,
 *      obviously-doable orders come back "not realistically achievable."
 * Feasible means #2 falls on or before #1 — i.e. this specific article, at
 * its real production rate, can actually keep pace with the generic rush
 * promise for this quantity. A slow/complex article or a large quantity
 * still naturally pushes #2 later than #1, correctly flagging it as not
 * genuinely achievable — it's the cross-article backlog specifically that
 * doesn't belong in that comparison, not quantity-sensitivity itself.
 *
 * requestedShipDate, when the caller already has a real target date (e.g.
 * a due date already set on the order), is compared against
 * earliestAchievableDate directly instead of the generic date — a firm
 * commitment is a more meaningful bar than the generic implication.
 */
export function checkRushFeasibility(
  quantity: number,
  activeBacklogUnits: number,
  unitsPerShift: number,
  dailyCapacityUnits: number = 144_000,
  laundryBufferDays: number = 2,
  rushLeadTimeReductionDays: number = 0,
  fromDate: Date = new Date(),
  requestedShipDate?: Date
): { feasible: boolean; earliestAchievableDate: Date; genericRushDate: Date; productionDays: number; totalDays: number } {
  const articleSpecific = calculateSuggestedShipDate(quantity, 0, unitsPerShift, laundryBufferDays, fromDate, rushLeadTimeReductionDays);
  const generic = calculateSuggestedShipDate(quantity, activeBacklogUnits, dailyCapacityUnits, laundryBufferDays, fromDate, rushLeadTimeReductionDays);

  // Compare by calendar day, not exact timestamp.
  const toDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const compareAgainst = requestedShipDate ? toDay(requestedShipDate) : toDay(generic.suggestedDate);
  const feasible = toDay(articleSpecific.suggestedDate) <= compareAgainst;

  return {
    feasible,
    earliestAchievableDate: articleSpecific.suggestedDate,
    genericRushDate: generic.suggestedDate,
    productionDays: articleSpecific.productionDays,
    totalDays: articleSpecific.totalDays,
  };
}

const CONTRACT_TERM_MONTHS: Record<string, number> = {
  '3 months': 3,
  '6 months': 6,
  '12 months': 12,
};

/**
 * Target delivery date implied by a Blanket PO's contract commitment term
 * (e.g. a "6-Month Season Contract" targets delivery 6 months out from
 * today). 'One-time' has no implied duration — returns null so the caller
 * leaves the date field for manual entry rather than guessing one. Returns
 * an ISO "yyyy-MM-dd" string, ready for a plain <input type="date"> value.
 */
export function calculateTargetDeliveryDateForContractTerm(
  contractDuration: string,
  fromDate: Date = new Date()
): string | null {
  const months = CONTRACT_TERM_MONTHS[contractDuration];
  if (!months) return null;
  const target = new Date(fromDate);
  target.setMonth(target.getMonth() + months);
  return target.toISOString().split('T')[0];
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
