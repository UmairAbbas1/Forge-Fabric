import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { StageJumpLog } from "../lib/types";

const LOCAL_STORAGE_STAGE_JUMP_KEY = "forge_flow_stage_jump_logs";

export function useStageJumpLogs(workOrderId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isRealSupabase = isSupabaseConfigured();

  const [localLogs, setLocalLogs] = useState<StageJumpLog[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_STAGE_JUMP_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Query stage jump logs from Supabase
  const {
    data: supabaseLogs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["stage_jump_logs", workOrderId],
    queryFn: async () => {
      if (!isRealSupabase || !workOrderId) return [];
      const { data, error } = await supabase
        .from("stage_jump_logs")
        .select(`
          id,
          work_order_id,
          from_stage_id,
          to_stage_id,
          jump_reason,
          validation_passed,
          validation_error,
          created_at,
          jumped_by,
          profiles:jumped_by (
            full_name,
            role
          )
        `)
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Failed to fetch stage_jump_logs from Supabase:", error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        work_order_id: row.work_order_id,
        from_stage_id: row.from_stage_id,
        to_stage_id: row.to_stage_id,
        jump_reason: row.jump_reason,
        validation_passed: row.validation_passed ?? true,
        validation_error: row.validation_error,
        created_at: row.created_at,
        jumped_by: row.jumped_by,
        jumped_by_name: row.profiles?.full_name || "Admin",
        jumped_by_role: row.profiles?.role || "admin",
      })) as StageJumpLog[];
    },
    enabled: isRealSupabase && Boolean(workOrderId),
    retry: 2,
  });

  // Realtime subscription for stage jump logs
  useEffect(() => {
    if (!isRealSupabase || !workOrderId) return;

    const channel = supabase
      .channel(`stage_jump_logs:${workOrderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stage_jump_logs",
          filter: `work_order_id=eq.${workOrderId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["stage_jump_logs", workOrderId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRealSupabase, workOrderId, queryClient]);

  // Record Stage Jump Mutation
  const recordJumpMutation = useMutation({
    mutationFn: async (payload: {
      work_order_id: string;
      from_stage_id: number;
      to_stage_id: number;
      jump_reason?: string;
      validation_passed?: boolean;
      validation_error?: string;
    }) => {
      const newLog: StageJumpLog = {
        id: `sjl-${Date.now()}`,
        work_order_id: payload.work_order_id,
        from_stage_id: payload.from_stage_id,
        to_stage_id: payload.to_stage_id,
        jump_reason: payload.jump_reason,
        validation_passed: payload.validation_passed ?? true,
        validation_error: payload.validation_error,
        created_at: new Date().toISOString(),
        jumped_by: user?.id,
        jumped_by_name: (user as any)?.full_name || (user as any)?.name || "System Admin",
        jumped_by_role: user?.role || "admin",
      };

      // 1. Update local cache
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_STAGE_JUMP_KEY);
        const existing: StageJumpLog[] = saved ? JSON.parse(saved) : [];
        const updated = [newLog, ...existing];
        localStorage.setItem(LOCAL_STORAGE_STAGE_JUMP_KEY, JSON.stringify(updated));
        setLocalLogs(updated);
      } catch (e) {
        console.error("Local storage stage jump update error:", e);
      }

      // 2. Insert to Supabase if connected
      if (isRealSupabase) {
        try {
          const { error } = await supabase.from("stage_jump_logs").insert({
            work_order_id: payload.work_order_id,
            from_stage_id: payload.from_stage_id,
            to_stage_id: payload.to_stage_id,
            jumped_by: user?.id || null,
            jump_reason: payload.jump_reason || null,
            validation_passed: payload.validation_passed ?? true,
            validation_error: payload.validation_error || null,
          });
          if (error) {
            console.warn("Supabase stage_jump_logs insert note:", error.message);
          }
        } catch (dbErr) {
          console.warn("Supabase stage_jump_logs db error:", dbErr);
        }
      }

      return newLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage_jump_logs", workOrderId] });
    },
  });

  // Filter logs for this specific order
  const filteredLocalLogs = workOrderId
    ? localLogs.filter((l) => l.work_order_id === workOrderId)
    : localLogs;

  const logs = isRealSupabase && supabaseLogs.length > 0 ? supabaseLogs : filteredLocalLogs;

  const recordJump = useCallback(
    async (params: {
      fromStage: number;
      toStage: number;
      reason?: string;
    }) => {
      if (!workOrderId) return;
      return recordJumpMutation.mutateAsync({
        work_order_id: workOrderId,
        from_stage_id: params.fromStage,
        to_stage_id: params.toStage,
        jump_reason: params.reason,
      });
    },
    [workOrderId, recordJumpMutation]
  );

  return {
    logs,
    isLoading,
    recordJump,
    refetch,
  };
}
