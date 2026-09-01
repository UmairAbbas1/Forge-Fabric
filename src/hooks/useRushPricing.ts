import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type ComplexityTier = "Simple" | "Moderate" | "Complex";
export type CycleProfileArticleType =
  | "Denim/Bottoms" | "Hoodie/Sweatshirt" | "T-Shirt" | "Jacket" | "Shorts" | "Dress" | "Kidswear" | "Custom/Other";

export interface ArticleCycleProfile {
  id: string;
  article_type: CycleProfileArticleType;
  complexity_tier: ComplexityTier;
  units_per_shift: number;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RushMultiplierTier {
  id: string;
  complexity_tier: ComplexityTier;
  multiplier: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CYCLE_KEY = ["article_cycle_profiles"];
const MULTIPLIER_KEY = ["rush_multiplier_tiers"];

export function useArticleCycleProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CYCLE_KEY,
    enabled: !!user && isRealSupabase,
    queryFn: async (): Promise<ArticleCycleProfile[]> => {
      const { data, error } = await supabase.from("article_cycle_profiles").select("*").order("article_type");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export interface CycleProfileInput {
  article_type: CycleProfileArticleType;
  complexity_tier: ComplexityTier;
  units_per_shift: number;
  notes?: string | null;
}

export function useSaveCycleProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CycleProfileInput) => {
      if (!user) throw new Error("Must be signed in.");
      const { error } = await supabase.from("article_cycle_profiles").insert({ ...input, created_by: user.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CYCLE_KEY }),
  });
}

export function useUpdateCycleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CycleProfileInput> }) => {
      const { error } = await supabase.from("article_cycle_profiles").update(updates).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CYCLE_KEY }),
  });
}

export function useDeactivateCycleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("article_cycle_profiles").update({ is_active: false }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CYCLE_KEY }),
  });
}

export function useReactivateCycleProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("article_cycle_profiles").update({ is_active: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CYCLE_KEY }),
  });
}

export function useRushMultiplierTiers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: MULTIPLIER_KEY,
    enabled: !!user && isRealSupabase,
    queryFn: async (): Promise<RushMultiplierTier[]> => {
      const { data, error } = await supabase.from("rush_multiplier_tiers").select("*").order("complexity_tier");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export interface MultiplierTierInput {
  complexity_tier: ComplexityTier;
  multiplier: number;
}

export function useSaveMultiplierTier() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: MultiplierTierInput) => {
      if (!user) throw new Error("Must be signed in.");
      const { error } = await supabase.from("rush_multiplier_tiers").insert({ ...input, created_by: user.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MULTIPLIER_KEY }),
  });
}

export function useUpdateMultiplierTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MultiplierTierInput> }) => {
      const { error } = await supabase.from("rush_multiplier_tiers").update(updates).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MULTIPLIER_KEY }),
  });
}

export function useDeactivateMultiplierTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rush_multiplier_tiers").update({ is_active: false }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MULTIPLIER_KEY }),
  });
}

export function useReactivateMultiplierTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rush_multiplier_tiers").update({ is_active: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MULTIPLIER_KEY }),
  });
}
