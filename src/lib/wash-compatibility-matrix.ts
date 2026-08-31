// Fabric/article -> wash-treatment compatibility matrix.
//
// A real, structured, local rule table (no runtime AI call) mapping a style
// block's physical fabric category to the wash/finishing treatments that
// actually make sense for it — Acid Wash and River Wash are denim-specific
// destructive processes that would damage or make no sense on a T-shirt's
// knit jersey; Bio-Polish/Peach Finish are light knit/woven treatments that
// have no place in a denim spec sheet.
//
// Category resolution: `product_type === 'Denim/Bottoms'` is the one place
// this data model expresses "this fabric is denim" — it wins regardless of
// the block's `fabric_type`. Every other product_type is a garment-shape
// value with no fabric implication (a 'Jacket' or 'T-Shirt' could be denim
// or not — the schema simply doesn't carry that signal for anything except
// the dedicated Denim/Bottoms product type), so those fall back to
// `fabric_type` alone. This is a known, real limitation of the current data
// model, not a guess papered over: a denim jacket submitted with
// product_type 'Jacket' will be treated as a plain Woven, not Denim, until
// the schema gains an independent "is this fabric denim" field.

import type { FabricType, ProductType } from '../contexts/ApplyWizardContext';

export type WashCategory = 'denim' | 'knit' | 'woven' | 'other';

export const WASH_CATEGORY_LABELS: Record<WashCategory, string> = {
  denim: 'Denim',
  knit: 'Knit / Jersey',
  woven: 'Woven (Non-Denim)',
  other: 'Other / Unclassified Fabric',
};

// Real treatments only — the "Other / Custom" escape hatch is layered on
// top uniformly by getWashOptionsFor(), never baked in here, so every
// category gets exactly one definition of what's physically compatible.
export const WASH_COMPATIBILITY_MATRIX: Record<WashCategory, string[]> = {
  denim: [
    'Raw / Rigid',
    'Stone Wash',
    'Acid Wash',
    'River Wash',
    'Bleach Wash',
    'Ozone Wash',
    'Enzyme Wash',
    'Garment Dye',
  ],
  knit: [
    'Garment Dye',
    'Silicone Softener Wash',
    'Enzyme Wash',
    'Bio-Polish / Peach Finish',
  ],
  woven: [
    'Garment Dye',
    'Silicone Softener Wash',
    'Enzyme Wash',
    'Peach Finish',
  ],
  other: [
    'Garment Dye',
    'Standard Softener Wash',
  ],
};

// The category-appropriate default when washing is selected but the
// customer/merchandiser never explicitly chose a wash type. Never a single
// value shared across categories — that would reintroduce the exact
// hardcoded-"Raw / Rigid"-for-everyone bug fixed in prior work.
export const WASH_CATEGORY_DEFAULT: Record<WashCategory, string> = {
  denim: 'Raw / Rigid',
  knit: 'Garment Dye',
  woven: 'Garment Dye',
  other: 'Garment Dye',
};

export const OTHER_CUSTOM_OPTION = 'Other';

/** Resolves which physical-fabric wash category a style block belongs to. */
export function resolveWashCategory(
  fabricType: FabricType | string | undefined,
  productType: ProductType | string | undefined
): WashCategory {
  if (productType === 'Denim/Bottoms') return 'denim';
  if (fabricType === 'Knit') return 'knit';
  if (fabricType === 'Woven') return 'woven';
  return 'other';
}

/** Real, category-compatible wash options for this block, plus the Other/Custom escape hatch — never omitted, every category. */
export function getWashOptionsFor(
  fabricType: FabricType | string | undefined,
  productType: ProductType | string | undefined
): string[] {
  const category = resolveWashCategory(fabricType, productType);
  return [...WASH_COMPATIBILITY_MATRIX[category], OTHER_CUSTOM_OPTION];
}

/** The real treatments only (no Other/Custom) — for validating whether an already-selected value is still a standard match after fabric/product changes. */
export function getWashTreatmentsFor(
  fabricType: FabricType | string | undefined,
  productType: ProductType | string | undefined
): string[] {
  const category = resolveWashCategory(fabricType, productType);
  return WASH_COMPATIBILITY_MATRIX[category];
}

/** Category-appropriate default wash type — always sourced from the matrix, never a single hardcoded value. */
export function getWashDefaultFor(
  fabricType: FabricType | string | undefined,
  productType: ProductType | string | undefined
): string {
  const category = resolveWashCategory(fabricType, productType);
  return WASH_CATEGORY_DEFAULT[category];
}
