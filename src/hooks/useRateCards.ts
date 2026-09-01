import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type RateCardArticleType =
  | "Denim/Bottoms" | "Hoodie/Sweatshirt" | "T-Shirt" | "Jacket" | "Shorts" | "Dress" | "Kidswear" | "Custom/Other";
export type RateCardProcess = "cmt_base" | "wash_surcharge" | "trims_packaging";
export type RateCardFabricCategory = "denim" | "knit" | "woven" | "other";

export interface RateCard {
  id: string;
  article_type: RateCardArticleType;
  process: RateCardProcess;
  fabric_category: RateCardFabricCategory;
  base_rate_usd: number;
  loaded_margin_percent: number;
  is_active: boolean;
  effective_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["rate_cards"];

export function useRateCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user && isRealSupabase,
    queryFn: async (): Promise<RateCard[]> => {
      const { data, error } = await supabase
        .from("rate_cards")
        .select("*")
        .order("article_type", { ascending: true })
        .order("process", { ascending: true })
        .order("fabric_category", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export interface RateCardInput {
  article_type: RateCardArticleType;
  process: RateCardProcess;
  fabric_category: RateCardFabricCategory;
  base_rate_usd: number;
  loaded_margin_percent: number;
  effective_date: string;
}

export function useSaveRateCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: RateCardInput) => {
      if (!user) throw new Error("Must be signed in.");
      const { error } = await supabase.from("rate_cards").insert({
        ...input,
        created_by: user.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateRateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RateCardInput> }) => {
      const { error } = await supabase.from("rate_cards").update(updates).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Never a hard delete — flips is_active false. A row referenced by an existing quote/invoice must remain valid history. */
export function useDeactivateRateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rate_cards").update({ is_active: false }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useReactivateRateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rate_cards").update({ is_active: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
