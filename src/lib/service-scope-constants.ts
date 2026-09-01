// REQ-14: Selective Stage Pipeline — customer-facing service catalog.
// Section 3A of Forge_Fabric_REQ14_REQ15_Implementation_Plan_v2.md.
//
// Customers never see "Stage 5" or "Stage 9" — they pick production
// services by name, and this module maps those choices to the internal
// 1-13 stage numbers used everywhere else in the app (see STAGES in
// src/lib/mockData.ts for the canonical stage list).
//
// SCOPE RESOLUTION NOTE: Section 3A's summary paragraph says the customer
// "selects from 6 production services (Cutting, Sewing, Pre-Wash QC,
// Washing, Finishing, Pressing/Packing)," but its own per-service table
// marks Pre-Wash QC, Final QC, and Dispatch as auto-included (not
// selectable), and the worked example in Section 6 ("Flow A") has the
// customer pick only Sewing + Washing + Packing while the system
// auto-includes Pre-Wash QC, Final QC, and Dispatch on top. This module
// follows the table + worked example (the more specific, testable source)
// rather than the summary count: 5 real selectable services, 5 auto-included
// support stages.

export type ServiceId =
  | 'fabric_receiving'
  | 'pre_production_planning'
  | 'cutting_bundling'
  | 'sewing_assembly'
  | 'pre_wash_qc'
  | 'washing_laundry'
  | 'finishing_effects'
  | 'final_qc'
  | 'pressing_tagging_packing'
  | 'dispatch_delivery';

export interface ServiceGroupDef {
  id: ServiceId;
  /** Customer-facing name — never shown as "Stage N". */
  name: string;
  description: string;
  /** Internal stage numbers this service maps to. */
  stages: number[];
  /** Whether the customer can toggle this service directly, or it is always derived. */
  selectable: boolean;
  /** Human-readable note on when/why this service is included — shown next to auto-included chips. */
  autoIncludeNote?: string;
}

export const SERVICE_GROUPS: Record<ServiceId, ServiceGroupDef> = {
  fabric_receiving: {
    id: 'fabric_receiving',
    name: 'Material Receiving & Inspection',
    description: 'We receive fabric and/or factory-sourced trims (buttons, zippers, thread, labels), inspect for defects, and log into inventory',
    stages: [1, 2, 3],
    selectable: false,
    autoIncludeNote: 'Included automatically on every order — even when you supply your own fabric or panels, we still receive and inspect our own trims/notions for your order',
  },
  pre_production_planning: {
    id: 'pre_production_planning',
    name: 'Pre-Production Planning',
    description: 'We plan cutting layouts, line allocation, and scheduling',
    stages: [4],
    selectable: false,
    autoIncludeNote: 'Included automatically whenever Cutting & Bundling is selected',
  },
  cutting_bundling: {
    id: 'cutting_bundling',
    name: 'Cutting & Bundling',
    description: 'We cut your fabric into panels by size/color and bundle them for assembly',
    stages: [5, 6],
    selectable: true,
  },
  sewing_assembly: {
    id: 'sewing_assembly',
    name: 'Sewing Assembly',
    description: 'We stitch cut panels into finished garments on industrial sewing lines',
    stages: [7],
    selectable: true,
  },
  pre_wash_qc: {
    id: 'pre_wash_qc',
    name: 'Pre-Wash Quality Check',
    description: 'We inspect stitched garments before any washing or finishing',
    stages: [8],
    selectable: false,
    autoIncludeNote: 'Included automatically whenever Sewing Assembly is selected',
  },
  washing_laundry: {
    id: 'washing_laundry',
    name: 'Washing & Laundry',
    description: 'Industrial washing, enzyme treatment, stonewash, softener, and drying',
    stages: [9],
    selectable: true,
  },
  finishing_effects: {
    id: 'finishing_effects',
    name: 'Finishing & Effects',
    description: 'Laser fading, ozone lightening, 3D creases, distressing, spray treatments',
    stages: [10],
    selectable: true,
  },
  final_qc: {
    id: 'final_qc',
    name: 'Final Quality Inspection',
    description: 'Comprehensive AQL inspection of the finished garment against the tech pack',
    stages: [11],
    selectable: false,
    autoIncludeNote: 'Included automatically on every order with at least one production service',
  },
  pressing_tagging_packing: {
    id: 'pressing_tagging_packing',
    name: 'Pressing, Tagging & Packing',
    description: 'Steam press, hangtags, care labels, brand labels, carton packing',
    stages: [12],
    selectable: true,
  },
  dispatch_delivery: {
    id: 'dispatch_delivery',
    name: 'Dispatch & Delivery',
    description: 'Final audit, shipping manifest, driver proof-of-delivery',
    stages: [13],
    selectable: false,
    autoIncludeNote: 'Always included — every order ships through Dispatch',
  },
};

/** The services a customer can actually toggle on the intake form. */
export const SELECTABLE_SERVICE_IDS: ServiceId[] = [
  'cutting_bundling',
  'sewing_assembly',
  'washing_laundry',
  'finishing_effects',
  'pressing_tagging_packing',
];

export const ALL_STAGE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export interface PresetScope {
  id: string;
  label: string;
  description: string;
  services: ServiceId[];
}

/** Section 3B preset shortcuts, shown above the service picker cards. */
export const PRESET_SCOPES: PresetScope[] = [
  {
    id: 'full_cmt',
    label: 'Full CMT',
    description: 'Cut, Make, Trim — the complete pipeline from raw fabric to dispatch',
    services: ['cutting_bundling', 'sewing_assembly', 'washing_laundry', 'finishing_effects', 'pressing_tagging_packing'],
  },
  {
    id: 'sew_wash_pack',
    label: 'Sew + Wash + Pack',
    description: 'Customer supplies cut panels — factory sews, washes, and packs',
    services: ['sewing_assembly', 'washing_laundry', 'pressing_tagging_packing'],
  },
  {
    id: 'wash_finish_only',
    label: 'Wash + Finish Only',
    description: 'Customer supplies sewn garments — factory washes, finishes, and packs',
    services: ['washing_laundry', 'finishing_effects', 'pressing_tagging_packing'],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Pick individual services',
    services: [],
  },
];

/**
 * Resolves a customer's selectable service picks into the full internal
 * selected_stages array, applying the auto-include dependency rules from
 * Section 3A: Material Receiving & Inspection (stages 1-3) runs on every
 * order with at least one production service selected — confirmed with the
 * business: even when a customer supplies their own fabric or pre-cut
 * panels, the factory still receives and inspects its own factory-sourced
 * trims/notions (buttons, zippers, thread, labels) for that order, so
 * skipping receiving entirely is the exception, not the default. Cutting &
 * Bundling additionally pulls in Pre-Production Planning (stage 4). Pre-Wash
 * QC rides along with Sewing Assembly, Final QC is included whenever any
 * production service is picked, and Dispatch is always included. Returns
 * stages in ascending order.
 *
 * `materialsSuppliedByCustomer` is the one deliberate, explicit opt-out: the
 * customer affirmatively states they are supplying fully-processed material
 * with no factory-sourced trims at all for this order, so stages 1-3 are
 * skipped. This must never be the silent result of picking a non-Cutting
 * service — see the checkbox in ServiceScopeSelector, shown only once
 * Cutting & Bundling is not selected (a Cutting order always receives raw
 * fabric, so the opt-out is never offered there).
 */
export function resolveSelectedStages(
  selectedServiceIds: ServiceId[],
  materialsSuppliedByCustomer: boolean = false
): number[] {
  const picked = new Set(selectedServiceIds.filter((id) => SELECTABLE_SERVICE_IDS.includes(id)));
  if (picked.size === 0) return [];

  const stages = new Set<number>();
  for (const id of picked) {
    for (const stage of SERVICE_GROUPS[id].stages) stages.add(stage);
  }
  // Material Receiving & Inspection — mandatory on every order unless the
  // customer explicitly declared they're supplying fully-processed material
  // with no factory-sourced trims (materialsSuppliedByCustomer).
  if (!materialsSuppliedByCustomer) {
    for (const stage of SERVICE_GROUPS.fabric_receiving.stages) stages.add(stage);
  }
  if (picked.has('cutting_bundling')) {
    for (const stage of SERVICE_GROUPS.pre_production_planning.stages) stages.add(stage);
  }
  if (picked.has('sewing_assembly')) {
    for (const stage of SERVICE_GROUPS.pre_wash_qc.stages) stages.add(stage);
  }
  for (const stage of SERVICE_GROUPS.final_qc.stages) stages.add(stage);
  for (const stage of SERVICE_GROUPS.dispatch_delivery.stages) stages.add(stage);

  return Array.from(stages).sort((a, b) => a - b);
}

/** Short chip abbreviations for the Kanban card's service-scope strip (Section 5B: "CUT • SEW • WASH • PACK"). */
export const SERVICE_CHIP_LABELS: Record<ServiceId, string> = {
  fabric_receiving: 'RECV',
  pre_production_planning: 'PLAN',
  cutting_bundling: 'CUT',
  sewing_assembly: 'SEW',
  pre_wash_qc: 'PWQC',
  washing_laundry: 'WASH',
  finishing_effects: 'FINISH',
  final_qc: 'QC',
  pressing_tagging_packing: 'PACK',
  dispatch_delivery: 'SHIP',
};

/**
 * Section 5B Kanban card header chip strip. Returns ["FULL CMT"] for the
 * full 13-stage default (undefined/absent selected_stages, or all 13
 * explicitly present) so a normal order doesn't show five redundant chips;
 * otherwise the abbreviated selectable-service chips actually in scope, in
 * canonical pipeline order.
 */
export function getServiceScopeChips(selectedStages: number[] | null | undefined): string[] {
  if (!selectedStages || selectedStages.length === 0 || selectedStages.length >= 13) return ['FULL CMT'];
  const present = new Set<ServiceId>();
  for (const id of SELECTABLE_SERVICE_IDS) {
    if (SERVICE_GROUPS[id].stages.some((s) => selectedStages.includes(s))) present.add(id);
  }
  return SELECTABLE_SERVICE_IDS.filter((id) => present.has(id)).map((id) => SERVICE_CHIP_LABELS[id]);
}

/**
 * Groups a resolved selected_stages array into the ordered, deduplicated
 * customer-facing service names for a "Receiving → Cutting → ... → Dispatch"
 * pipeline preview strip. Shared by ServiceScopeSelector (intake) and
 * ConversionModal (merchandiser review) so both render the identical
 * sequence for the same stage array.
 */
export function buildPipelinePreviewLabels(stages: number[]): string[] {
  const labels: string[] = [];
  let last: string | null = null;
  for (const stage of stages) {
    const group = Object.values(SERVICE_GROUPS).find((g) => g.stages.includes(stage));
    const label = group?.name ?? `Stage ${stage}`;
    if (label !== last) {
      labels.push(label);
      last = label;
    }
  }
  return labels;
}
