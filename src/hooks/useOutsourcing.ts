import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { MaterialType } from "../lib/outsourcing-constants";

// REQ-15: Enhanced Outsourcing — TanStack Query hooks for dispatch, receive,
// return QC, and list-by-order against public.stage_outsourcing_records /
// public.outsource_return_qc (both added by supabase/migrations/
// 20260825000000_selective_pipeline_and_enhanced_outsourcing.sql, RLS-gated
// to is_internal_staff() — a customer-role session gets zero rows back from
// either table regardless of what the frontend renders).

export type VendorStatus = "Dispatched" | "In_Process" | "Returned_Partial" | "Returned_Complete" | "Defect_Hold";
export type ReturnQCStatus = "Pending" | "Passed" | "Failed" | "Rework" | "Partial_Pass";

export interface OutsourceRecord {
  id: string;
  order_id: string;
  stage_number: number;
  stage_name: string;
  vendor_name: string;
  vendor_facility_location?: string | null;
  outsource_po_number: string;
  quantity_dispatched: number;
  quantity_received: number;
  quantity_short?: number;
  unit_cost_usd?: number;
  total_cost_usd?: number;
  dispatched_at: string;
  expected_return_at?: string | null;
  received_at?: string | null;
  vendor_status: VendorStatus;
  notes?: string | null;
  logged_by?: string | null;
  logged_by_id?: string | null;
  material_type: MaterialType;
  material_description?: string | null;
  dispatched_by_user_id?: string | null;
  dispatched_by_name?: string | null;
  received_by_user_id?: string | null;
  received_by_name?: string | null;
  return_qc_status: ReturnQCStatus;
  return_qc_inspection_id?: string | null;
  return_qc_notes?: string | null;
  transport_method?: string | null;
  vehicle_reference?: string | null;
  created_at: string;
}

export interface OutsourceReturnQC {
  id: string;
  outsource_record_id: string;
  order_id: string;
  stage_number: number;
  inspector_id?: string | null;
  inspector_name: string;
  inspected_qty: number;
  passed_qty: number;
  failed_qty: number;
  rework_qty: number;
  defect_notes?: string | null;
  photos?: string[] | null;
  result: ReturnQCStatus;
  inspected_at?: string | null;
  created_at: string;
}

/** All outsource records for one order — powers StageOutsourcingPanel on the order detail page. */
export function useOutsourceRecordsByOrder(orderId: string) {
  return useQuery<OutsourceRecord[]>({
    queryKey: ["outsource_records", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stage_outsourcing_records")
        .select("*")
        .eq("order_id", orderId)
        .order("dispatched_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!orderId,
    staleTime: 1_000,
  });
}

/**
 * Every outsource record across every order. Powers the cutting/sewing/wash
 * "Outsourced to [vendor]" badges (Section 7) and the outsource QC gate in
 * checkStageAdvancement (Section 4D) — both need to know, for an arbitrary
 * order + stage pair, whether that stage is currently routed to a vendor.
 */
export function useAllOutsourceRecords() {
  return useQuery<OutsourceRecord[]>({
    queryKey: ["outsource_records_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stage_outsourcing_records").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase,
    staleTime: 1_000,
  });
}

/**
 * Finds the active (not yet fully returned) outsource record for a given
 * order + set of stage numbers, if any. Powers the "Outsourced to [vendor]"
 * badges on cutting.tsx/sewing.tsx/wash.tsx (Section 7) — those pages only
 * need a yes/no + vendor name for the specific order+stage they're editing,
 * not the full list useOutsourceRecordsByOrder returns.
 */
export function useActiveOutsourceRecord(orderId: string | undefined, stageNumbers: number[]): OutsourceRecord | null {
  const { data: allRecords = [] } = useAllOutsourceRecords();
  if (!orderId) return null;
  return (
    allRecords.find(
      (r) => r.order_id === orderId && stageNumbers.includes(r.stage_number) && r.vendor_status !== "Returned_Complete"
    ) || null
  );
}

/** Return QC rows still awaiting inspection — the "Outsource Return QC" tab in /qc. */
export function usePendingReturnQCInspections() {
  return useQuery<Array<OutsourceReturnQC & { outsource_record: OutsourceRecord | null }>>({
    queryKey: ["outsource_return_qc_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outsource_return_qc")
        .select("*, outsource_record:stage_outsourcing_records(*)")
        .eq("result", "Pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: isRealSupabase,
    staleTime: 1_000,
  });
}

export interface DispatchOutsourceInput {
  order_id: string;
  stage_number: number;
  stage_name: string;
  vendor_name: string;
  vendor_facility_location?: string;
  outsource_po_number: string;
  quantity_dispatched: number;
  unit_cost_usd?: number;
  expected_return_at?: string;
  notes?: string;
  material_type: MaterialType;
  material_description?: string;
  transport_method?: string;
  vehicle_reference?: string;
}

/** Dispatch mode: send a stage's work out to an external vendor. */
export function useDispatchOutsource() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: DispatchOutsourceInput) => {
      if (!isRealSupabase) throw new Error("Not connected to the live database.");
      const { error } = await supabase.from("stage_outsourcing_records").insert({
        ...input,
        total_cost_usd: input.unit_cost_usd ? Math.round(input.unit_cost_usd * input.quantity_dispatched * 100) / 100 : 0,
        vendor_status: "Dispatched" as VendorStatus,
        return_qc_status: "Pending" as ReturnQCStatus,
        dispatched_by_user_id: user?.id,
        dispatched_by_name: user?.full_name || user?.email || "Unknown",
        logged_by: user?.full_name || user?.email,
        logged_by_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["outsource_records", vars.order_id] });
      queryClient.invalidateQueries({ queryKey: ["outsource_records_all"] });
    },
  });
}

/**
 * Receive mode: log a vendor return. Quantity short is DB-computed
 * (stage_outsourcing_records.quantity_short is a generated column).
 * Auto-creates the mandatory outsource_return_qc row (Section 4D step 1) —
 * the stage stays blocked (return_qc_status stays 'Pending') until an
 * inspector actually completes that row via useSubmitReturnQC.
 */
export function useReceiveOutsource() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { record: OutsourceRecord; quantity_received: number }) => {
      if (!isRealSupabase) throw new Error("Not connected to the live database.");
      const { record, quantity_received } = input;
      if (quantity_received > record.quantity_dispatched) {
        throw new Error(`Quantity received (${quantity_received}) cannot exceed quantity dispatched (${record.quantity_dispatched}).`);
      }
      const vendor_status: VendorStatus = quantity_received >= record.quantity_dispatched ? "Returned_Complete" : "Returned_Partial";

      const { error } = await supabase
        .from("stage_outsourcing_records")
        .update({
          quantity_received,
          received_at: new Date().toISOString(),
          received_by_user_id: user?.id,
          received_by_name: user?.full_name || user?.email || "Unknown",
          vendor_status,
        })
        .eq("id", record.id);
      if (error) throw error;

      const { error: qcError } = await supabase.from("outsource_return_qc").insert({
        outsource_record_id: record.id,
        order_id: record.order_id,
        stage_number: record.stage_number,
        inspector_name: "Pending Assignment",
        inspected_qty: 0,
        result: "Pending" as ReturnQCStatus,
      });
      if (qcError) throw qcError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["outsource_records", vars.record.order_id] });
      queryClient.invalidateQueries({ queryKey: ["outsource_records_all"] });
      queryClient.invalidateQueries({ queryKey: ["outsource_return_qc_pending"] });
    },
  });
}

export interface SubmitReturnQCInput {
  qc_id: string;
  outsource_record_id: string;
  order_id: string;
  inspected_qty: number;
  passed_qty: number;
  failed_qty: number;
  rework_qty: number;
  defect_notes?: string;
  photos?: string[];
  result: "Passed" | "Failed" | "Rework" | "Partial_Pass";
}

/**
 * Inspector completes the return QC row, and that result propagates onto
 * stage_outsourcing_records.return_qc_status — the exact field the outsource
 * QC gate (checkStageAdvancement / DB trigger enforce_order_stage_gates)
 * reads to decide whether the order can leave this stage (Section 4D).
 */
export function useSubmitReturnQC() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: SubmitReturnQCInput) => {
      if (!isRealSupabase) throw new Error("Not connected to the live database.");

      const { error: qcError } = await supabase
        .from("outsource_return_qc")
        .update({
          inspector_id: user?.id,
          inspector_name: user?.full_name || user?.email || "Unknown",
          inspected_qty: input.inspected_qty,
          passed_qty: input.passed_qty,
          failed_qty: input.failed_qty,
          rework_qty: input.rework_qty,
          defect_notes: input.defect_notes,
          photos: input.photos,
          result: input.result,
          inspected_at: new Date().toISOString(),
        })
        .eq("id", input.qc_id);
      if (qcError) throw qcError;

      const { error: recordError } = await supabase
        .from("stage_outsourcing_records")
        .update({
          return_qc_status: input.result,
          return_qc_inspection_id: input.qc_id,
          return_qc_notes: input.defect_notes,
        })
        .eq("id", input.outsource_record_id);
      if (recordError) throw recordError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["outsource_records", vars.order_id] });
      queryClient.invalidateQueries({ queryKey: ["outsource_records_all"] });
      queryClient.invalidateQueries({ queryKey: ["outsource_return_qc_pending"] });
    },
  });
}
