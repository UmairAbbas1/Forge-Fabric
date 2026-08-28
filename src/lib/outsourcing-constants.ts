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

/**
 * REQ-14 Selective Pipeline: an order's real progress is its position within
 * the SPECIFIC stages it selected at intake, not a raw "current_stage/13"
 * fraction against the full internal numbering. An order that only selected
 * Sewing + Washing + Finishing (stages [7, 9, 12, 13], say) is 100% done the
 * moment it clears stage 13, even though 13 is far short of the number 13 in
 * absolute terms if unrelated stages were skipped along the way.
 *
 * `selected_stages` may be missing/empty on older orders and on submissions
 * that never captured a selection — this always falls back to the full
 * 1-13 pipeline so those still render a sensible (if generic) fraction
 * rather than dividing by zero or showing an empty progress bar.
 */
export function getStageProgress(
  currentStage: number,
  selectedStages?: number[] | null
): { position: number; total: number; pipeline: number[] } {
  const pipeline = selectedStages && selectedStages.length > 0
    ? [...new Set(selectedStages)].sort((a, b) => a - b)
    : Array.from({ length: 13 }, (_, i) => i + 1);

  const idx = pipeline.indexOf(currentStage);
  // current_stage always lands exactly on a pipeline entry in the normal
  // flow (advanceOrderStage/handleStageJump only ever set it to a selected
  // stage), but if it's ever slightly out of sync, count how many selected
  // stages have been reached so progress still reads sensibly instead of
  // silently showing position 1.
  const position = idx >= 0 ? idx + 1 : Math.max(1, pipeline.filter((s) => s <= currentStage).length);

  return { position: Math.min(position, pipeline.length), total: pipeline.length, pipeline };
}
