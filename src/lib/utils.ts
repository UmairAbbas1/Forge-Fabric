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
