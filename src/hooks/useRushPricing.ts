import { useEffect } from "react";
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

export const DEFAULT_RUSH_TIERS: RushMultiplierTier[] = [
  { id: "default-simple", complexity_tier: "Simple", multiplier: 1.40, is_active: true, created_by: null, created_at: "", updated_at: "" },
  { id: "default-moderate", complexity_tier: "Moderate", multiplier: 2.00, is_active: true, created_by: null, created_at: "", updated_at: "" },
  { id: "default-complex", complexity_tier: "Complex", multiplier: 2.50, is_active: true, created_by: null, created_at: "", updated_at: "" },
];

export function getRushMultiplierForTier(
  tiers: RushMultiplierTier[] | undefined,
  tier: ComplexityTier | string = "Moderate"
): number {
  const activeTiers = tiers && tiers.length > 0 ? tiers : DEFAULT_RUSH_TIERS;
  const match = activeTiers.find((t) => t.is_active && t.complexity_tier.toLowerCase() === tier.toLowerCase());
  if (match) return match.multiplier;
  const fallback = DEFAULT_RUSH_TIERS.find((t) => t.complexity_tier.toLowerCase() === tier.toLowerCase());
  return fallback?.multiplier ?? 1.50;
}

const CYCLE_KEY = ["article_cycle_profiles"];
const MULTIPLIER_KEY = ["rush_multiplier_tiers"];

export function useArticleCycleProfiles() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isRealSupabase) return;
    const channel = supabase
      .channel("article_cycle_profiles_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "article_cycle_profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: CYCLE_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: CYCLE_KEY,
    enabled: isRealSupabase,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ArticleCycleProfile[]> => {
      const { data, error } = await supabase
        .from("article_cycle_profiles")
        .select("*")
        .eq("is_active", true)
        .order("article_type");

      if (error) {
        console.warn("Could not fetch article_cycle_profiles:", error.message);
        return [];
      }
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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isRealSupabase) return;
    const channel = supabase
      .channel("rush_multiplier_tiers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rush_multiplier_tiers" },
        () => {
          queryClient.invalidateQueries({ queryKey: MULTIPLIER_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: MULTIPLIER_KEY,
    enabled: isRealSupabase,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<RushMultiplierTier[]> => {
      const { data, error } = await supabase
        .from("rush_multiplier_tiers")
        .select("*")
        .eq("is_active", true)
        .order("complexity_tier");

      if (error) {
        console.warn("Could not fetch rush_multiplier_tiers, using default tiers:", error.message);
        return DEFAULT_RUSH_TIERS;
      }
      if (!data || data.length === 0) {
        return DEFAULT_RUSH_TIERS;
      }
      return data;
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
