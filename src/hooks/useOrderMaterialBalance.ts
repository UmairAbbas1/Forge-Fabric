import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";

// See supabase/migrations/20260901001600_real_material_consumption_and_shortage_holds.sql
// order_material_balance is a live view: qty_received (approved GRN material,
// `materials` table) vs. qty_used (real inventory_issuances rows, now that
// cutting.tsx actually writes them with the correct column names) vs.
// qty_remaining. No mock fallback — an order simply has no balance row
// entry until real material/issuance activity exists for it.

export interface OrderMaterialBalance {
  order_id: string;
  qty_received: number;
  qty_used: number;
  qty_remaining: number;
}

const QUERY_KEY = ["order_material_balance"];

/** All order material balances, keyed by order_id for O(1) lookup per Work Order card. */
export function useOrderMaterialBalances() {
  const { data = [], isLoading, refetch } = useQuery<OrderMaterialBalance[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!isRealSupabase) return [];
      const { data, error } = await supabase.from("order_material_balance").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase,
    staleTime: 15_000,
    retry: 1,
  });

  const byOrderId = new Map(data.map((b) => [b.order_id, b]));

  return { balances: data, byOrderId, isLoading, refetch };
}

/** Staff-only explicit hold release — see release_material_hold's SECURITY DEFINER
    role check; the RPC itself re-verifies the balance server-side and raises if
    the order is still genuinely short, so this never silently no-ops. */
export function useReleaseMaterialHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc("release_material_hold", { p_order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
