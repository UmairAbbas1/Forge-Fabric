import type { Order, QCRecord } from "./mockData";

export interface QCGateCheckpoint {
  name: "Material Check" | "First Cut Approval" | "Inline Sewing QC" | "Wash-Finish Approval" | "Final AQL-Packing Audit";
  minStage: number;
  prereqName: string | null;
}

export const QC_PIPELINE_STAGES: QCGateCheckpoint[] = [
  { name: "Material Check", minStage: 2, prereqName: null },
  { name: "First Cut Approval", minStage: 4, prereqName: "Material Check" },
  { name: "Inline Sewing QC", minStage: 6, prereqName: "First Cut Approval" },
  { name: "Wash-Finish Approval", minStage: 8, prereqName: "Inline Sewing QC" },
  { name: "Final AQL-Packing Audit", minStage: 11, prereqName: "Wash-Finish Approval" },
];

/**
  Normalizes checkpoint strings for comparison (handling slight variations like "Wash/Finish Approval" vs "Wash-Finish Approval")
 */
export function normalizeCheckpointName(name: string): string {
  return name.replace("/", "-").trim();
}

/**
 * Validates if an order is eligible for a specific QC Checkpoint based on sequential process order.
 */
export function validateQCCheckpointEligibility(
  order: Order,
  checkpointName: string,
  allQcRecords: QCRecord[]
): { allowed: boolean; reason?: string; prereqName?: string } {
  const normTarget = normalizeCheckpointName(checkpointName);
  const targetGate = QC_PIPELINE_STAGES.find((g) => normalizeCheckpointName(g.name) === normTarget);

  if (!targetGate) {
    return { allowed: true };
  }

  // 1. Order current stage check
  if (order.current_stage < targetGate.minStage) {
    return {
      allowed: false,
      reason: `Order ${order.order_id} is currently at Stage ${order.current_stage}. "${checkpointName}" requires Order to reach Stage ${targetGate.minStage} or higher.`,
    };
  }

  // 2. Prerequisite checkpoint check
  if (targetGate.prereqName) {
    const normPrereq = normalizeCheckpointName(targetGate.prereqName);
    const orderQc = allQcRecords.filter((q) => q.order_id === order.order_id);
    const hasPassedPrereq = orderQc.some(
      (q) => normalizeCheckpointName(q.stage_checkpoint) === normPrereq && q.result !== "Reject"
    );

    if (!hasPassedPrereq) {
      return {
        allowed: false,
        prereqName: targetGate.prereqName,
        reason: `Sequential Gate Error: Order ${order.order_id} must complete and pass "${targetGate.prereqName}" before logging "${checkpointName}".`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Validates QC inspected, pass, and reject quantities.
 */
export function validateQCQuantities(
  inspectedQty: number,
  passQty: number,
  rejectQty: number,
  orderQty: number
): { valid: boolean; error?: string } {
  if (inspectedQty <= 0) {
    return { valid: false, error: "Inspected quantity must be greater than zero." };
  }

  if (inspectedQty > orderQty) {
    return {
      valid: false,
      error: `Inspected quantity (${inspectedQty}) cannot exceed total Order Quantity (${orderQty}).`,
    };
  }

  if (passQty < 0 || rejectQty < 0) {
    return { valid: false, error: "Pass and reject quantities cannot be negative." };
  }

  if (passQty > inspectedQty) {
    return {
      valid: false,
      error: `Pass quantity (${passQty}) cannot be greater than total Inspected (${inspectedQty}).`,
    };
  }

  if (rejectQty > inspectedQty) {
    return {
      valid: false,
      error: `Reject quantity (${rejectQty}) cannot be greater than total Inspected (${inspectedQty}).`,
    };
  }

  if (passQty + rejectQty !== inspectedQty) {
    return {
      valid: false,
      error: `Pass (${passQty}) + Reject (${rejectQty}) = ${passQty + rejectQty}, which does not match total Inspected quantity (${inspectedQty}).`,
    };
  }

  return { valid: true };
}
