import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type SampleArticleType =
  | "Denim/Bottoms" | "Hoodie/Sweatshirt" | "T-Shirt" | "Jacket" | "Shorts" | "Dress" | "Kidswear" | "Custom/Other";

export interface SamplePricingRule {
  id: string;
  article_type: SampleArticleType;
  flat_fee_usd: number | null;
  per_unit_rate_usd: number | null;
  is_active: boolean;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["sample_pricing_rules"];

export function useSamplePricingRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user && isRealSupabase,
    queryFn: async (): Promise<SamplePricingRule[]> => {
      const { data, error } = await supabase.from("sample_pricing_rules").select("*").order("article_type");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export interface SamplePricingRuleInput {
  article_type: SampleArticleType;
  flat_fee_usd?: number | null;
  per_unit_rate_usd?: number | null;
  notes?: string | null;
}

export function useSaveSamplePricingRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: SamplePricingRuleInput) => {
      if (!user) throw new Error("Must be signed in.");
      if (!input.flat_fee_usd && !input.per_unit_rate_usd) {
        throw new Error("Enter a flat fee, a per-unit rate, or both.");
      }
      const { error } = await supabase.from("sample_pricing_rules").insert({ ...input, created_by: user.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateSamplePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SamplePricingRuleInput> }) => {
      const { error } = await supabase.from("sample_pricing_rules").update(updates).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeactivateSamplePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sample_pricing_rules").update({ is_active: false }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useReactivateSamplePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sample_pricing_rules").update({ is_active: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
