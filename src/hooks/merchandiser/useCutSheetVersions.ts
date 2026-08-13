import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type {
  ApplyCutSheet,
  CutSheetVersionRecord,
  CutSheetSemanticDiffItem,
  CutSheetApprovalStatus,
  CutSheetData,
} from "../../lib/types";

// Semantic Diff Engine (Fix #7 & Warning #10)
export function computeCutSheetSemanticDiff(
  oldData?: CutSheetData,
  newData?: CutSheetData
): CutSheetSemanticDiffItem[] {
  const diffs: CutSheetSemanticDiffItem[] = [];
  if (!oldData || !newData) return diffs;

  // 1. Compare grand total
  if ((oldData.grand_total || 0) !== (newData.grand_total || 0)) {
    const delta = (newData.grand_total || 0) - (oldData.grand_total || 0);
    diffs.push({
      type: 'size_qty',
      label: 'Grand Total Units',
      old_value: `${oldData.grand_total || 0} pcs`,
      new_value: `${newData.grand_total || 0} pcs`,
      delta,
    });
  }

  // 2. Compare wash type
  if (oldData.wash_type !== newData.wash_type) {
    diffs.push({
      type: 'meta',
      label: 'Wash Process Formula',
      old_value: oldData.wash_type || 'None',
      new_value: newData.wash_type || 'None',
    });
  }

  // 3. Compare component sizes & plies (e.g. Factory One style)
  const oldComp = oldData.components?.[0];
  const newComp = newData.components?.[0];

  if (oldComp && newComp) {
    // Check estimated yield
    if (oldComp.estimated_yield !== newComp.estimated_yield) {
      diffs.push({
        type: 'yield',
        label: 'Fabric Estimated Yield',
        old_value: `${oldComp.estimated_yield} yds/garment`,
        new_value: `${newComp.estimated_yield} yds/garment`,
        delta: Number((newComp.estimated_yield - oldComp.estimated_yield).toFixed(2)),
      });
    }

    // Check size breakdown diffs
    const allSizes = Array.from(
      new Set([...Object.keys(oldComp.size_matrix || {}), ...Object.keys(newComp.size_matrix || {})])
    );

    allSizes.forEach((sz) => {
      const oldQty = oldComp.size_matrix?.[sz] || 0;
      const newQty = newComp.size_matrix?.[sz] || 0;
      if (oldQty !== newQty) {
        diffs.push({
          type: 'size_qty',
          label: `Size ${sz} Quantity`,
          old_value: oldQty,
          new_value: newQty,
          delta: newQty - oldQty,
        });
      }
    });

    // Check ticket yards
    if ((oldComp.ticket_yards || 0) !== (newComp.ticket_yards || 0)) {
      diffs.push({
        type: 'yield',
        label: 'Total Ticket Yardage',
        old_value: `${oldComp.ticket_yards || 0} yds`,
        new_value: `${newComp.ticket_yards || 0} yds`,
        delta: (newComp.ticket_yards || 0) - (oldComp.ticket_yards || 0),
      });
    }
  }

  return diffs;
}

export function useCutSheetVersions(cutSheetId?: string) {
  const queryClient = useQueryClient();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const { data: versions = [], isLoading, refetch } = useQuery<CutSheetVersionRecord[]>({
    queryKey: ['cut_sheet_versions', cutSheetId],
    queryFn: async () => {
      if (!cutSheetId) return [];

      const storageKey = `cut_sheet_versions_${cutSheetId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try { return JSON.parse(saved); } catch (_) {}
      }

      // Default mock initial version v1.0
      const initialVersion: CutSheetVersionRecord = {
        id: `ver-${cutSheetId}-1.0`,
        cut_sheet_id: cutSheetId,
        version: 1.0,
        change_summary: "Initial intake submission snapshot",
        created_by: "Intake Wizard",
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        approval_status: "submitted",
        snapshot: {
          grand_total: 0,
          wash_type: "Standard Finish",
          components: [
            {
              component_name: "SELF",
              fabric_code: "",
              fabric_desc: "",
              number_of_spreads: 1,
              estimated_yield: 0,
              damage_percent: 0,
              short_percent: 0,
              plies: 1,
              size_columns: ["S", "M", "L", "XL"],
              size_matrix: {},
              color_lot: "",
              total_units: 0,
              ticket_yards: 0,
              yards_cut: 0,
            }
          ]
        }
      };

      return [initialVersion];
    },
    enabled: !!cutSheetId,
  });

  // Create new version snapshot (v1.1, v1.2)
  const createNewVersion = useMutation({
    mutationFn: async ({
      summary,
      snapshot,
      createdBy = "Merchandiser",
    }: {
      summary: string;
      snapshot: CutSheetData;
      createdBy?: string;
    }) => {
      if (!cutSheetId) throw new Error("Missing cutSheetId");

      const nextVersionNum = Number(((versions[0]?.version || 1.0) + 0.1).toFixed(1));
      const newRecord: CutSheetVersionRecord = {
        id: `ver-${cutSheetId}-${nextVersionNum}`,
        cut_sheet_id: cutSheetId,
        version: nextVersionNum,
        change_summary: summary,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        approval_status: "draft",
        snapshot,
      };

      const updated = [newRecord, ...versions];
      localStorage.setItem(`cut_sheet_versions_${cutSheetId}`, JSON.stringify(updated));
      return newRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cut_sheet_versions', cutSheetId] });
      queryClient.invalidateQueries({ queryKey: ['submission_detail'] });
    },
  });

  // Approval state transitions (Fix #9)
  const setApprovalStatus = useMutation({
    mutationFn: async ({
      versionId,
      status,
      reason,
      approvedBy = "Lead Merchandiser",
    }: {
      versionId: string;
      status: CutSheetApprovalStatus;
      reason?: string;
      approvedBy?: string;
    }) => {
      const updated = versions.map((v) =>
        v.id === versionId
          ? { ...v, approval_status: status, change_summary: reason ? `${v.change_summary} (Rejected: ${reason})` : v.change_summary }
          : v
      );
      localStorage.setItem(`cut_sheet_versions_${cutSheetId}`, JSON.stringify(updated));
      return { versionId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cut_sheet_versions', cutSheetId] });
      queryClient.invalidateQueries({ queryKey: ['submission_detail'] });
    },
  });

  // Computed semantic diff
  const activeDiff = useMemo(() => {
    if (!selectedVersionId || !compareVersionId) return [];
    const v1 = versions.find((v) => v.id === selectedVersionId);
    const v2 = versions.find((v) => v.id === compareVersionId);
    return computeCutSheetSemanticDiff(v1?.snapshot, v2?.snapshot);
  }, [versions, selectedVersionId, compareVersionId]);

  return {
    versions,
    isLoading,
    refetch,
    selectedVersionId,
    setSelectedVersionId,
    compareVersionId,
    setCompareVersionId,
    activeDiff,
    createNewVersion: createNewVersion.mutateAsync,
    setApprovalStatus: setApprovalStatus.mutateAsync,
  };
}
