// REQ-15: Enhanced Outsourcing — material type & friendly name lookup by stage.
// Section 4B of Forge_Fabric_REQ14_REQ15_Implementation_Plan_v2.md.
//
// Mirrors the material_type CHECK constraint added to
// public.stage_outsourcing_records by
// supabase/migrations/20260825000000_selective_pipeline_and_enhanced_outsourcing.sql
// — keep the two in sync if either changes.

export type MaterialType =
  | 'general'
  | 'fabric_rolls'
  | 'cut_panels'
  | 'stitched_garments'
  | 'washed_garments'
  | 'finished_garments'
  | 'packed_cartons';

export interface StageMaterialInfo {
  materialType: MaterialType;
  /** What goes out to the vendor when this stage is dispatched. */
  dispatchLabel: string;
  /** What is expected back when the vendor returns the work. */
  returnLabel: string;
}

/** Stage number (1-13) -> what goes out / comes back when that stage is outsourced. */
export const STAGE_MATERIAL_MAP: Record<number, StageMaterialInfo> = {
  1: { materialType: 'fabric_rolls', dispatchLabel: 'Raw fabric rolls + trims', returnLabel: 'Inspected/sorted fabric' },
  2: { materialType: 'fabric_rolls', dispatchLabel: 'Raw fabric rolls + trims', returnLabel: 'Inspected/sorted fabric' },
  3: { materialType: 'fabric_rolls', dispatchLabel: 'Raw fabric rolls + trims', returnLabel: 'Inspected/sorted fabric' },
  4: { materialType: 'general', dispatchLabel: 'N/A (admin stage)', returnLabel: 'Planning docs' },
  5: { materialType: 'fabric_rolls', dispatchLabel: 'Fabric rolls + marker files', returnLabel: 'Cut panels by size/color' },
  6: { materialType: 'fabric_rolls', dispatchLabel: 'Fabric rolls + marker files', returnLabel: 'Cut panels by size/color' },
  7: { materialType: 'cut_panels', dispatchLabel: 'Bundled cut panels', returnLabel: 'Stitched garments (unfinished)' },
  8: { materialType: 'stitched_garments', dispatchLabel: 'Stitched garments', returnLabel: 'QC-passed garments' },
  9: { materialType: 'stitched_garments', dispatchLabel: 'Stitched garments', returnLabel: 'Washed garments' },
  10: { materialType: 'washed_garments', dispatchLabel: 'Washed garments', returnLabel: 'Finished garments' },
  11: { materialType: 'finished_garments', dispatchLabel: 'Finished garments', returnLabel: 'QC-passed garments' },
  12: { materialType: 'finished_garments', dispatchLabel: 'Finished garments', returnLabel: 'Packed cartons' },
  13: { materialType: 'packed_cartons', dispatchLabel: 'Packed cartons', returnLabel: 'Shipped (N/A)' },
};

/** Stage number (1-13) -> customer-facing service name (Section 3A/4B). Never expose raw "Stage N" text to customers. */
export const STAGE_FRIENDLY_NAMES: Record<number, string> = {
  1: 'Fabric Receiving & Inspection',
  2: 'Fabric Receiving & Inspection',
  3: 'Fabric Receiving & Inspection',
  4: 'Pre-Production Planning',
  5: 'Cutting & Bundling',
  6: 'Cutting & Bundling',
  7: 'Sewing Assembly',
  8: 'Pre-Wash Quality Check',
  9: 'Washing & Laundry',
  10: 'Finishing & Effects',
  11: 'Final Quality Inspection',
  12: 'Pressing, Tagging & Packing',
  13: 'Dispatch & Delivery',
};

/** Looks up material info for a stage, falling back to 'general' for any stage outside 1-13. */
export function getStageMaterialInfo(stageNumber: number): StageMaterialInfo {
  return STAGE_MATERIAL_MAP[stageNumber] ?? { materialType: 'general', dispatchLabel: 'N/A', returnLabel: 'N/A' };
}

/** Looks up the customer-facing name for a stage, falling back to a generic label for any stage outside 1-13. */
export function getStageFriendlyName(stageNumber: number): string {
  return STAGE_FRIENDLY_NAMES[stageNumber] ?? `Stage ${stageNumber}`;
}
