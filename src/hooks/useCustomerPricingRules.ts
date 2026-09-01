import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface CustomerPricingRule {
  id: string;
  company_id: string;
  discount_type: "percent";
  discount_percent: number | null;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined for display — company name isn't stored on this table itself.
  companies?: { id: string; name: string } | null;
}

const QUERY_KEY = ["customer_pricing_rules"];
const COMPANIES_KEY = ["companies_for_pricing_picker"];

export function useCustomerPricingRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user && isRealSupabase,
    queryFn: async (): Promise<CustomerPricingRule[]> => {
      const { data, error } = await supabase
        .from("customer_pricing_rules")
        .select("*, companies(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

/** Real company list for the discount rule's company search/select — no mock/dummy entries. */
export function useCompaniesForPricingPicker() {
  const { user } = useAuth();
  return useQuery({
    queryKey: COMPANIES_KEY,
    enabled: !!user && isRealSupabase,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export interface CustomerPricingRuleInput {
  company_id: string;
  discount_percent: number;
  effective_from: string;
  effective_until?: string | null;
  notes?: string | null;
}

async function writeAuditLog(
  action: "customer_pricing_rule_created" | "customer_pricing_rule_updated" | "customer_pricing_rule_deactivated",
  actorId: string,
  actorEmail: string | undefined,
  companyId: string,
  companyName: string | undefined,
  details: Record<string, unknown>
) {
  // Best-effort — a failed audit write must never block the actual pricing
  // change (audit_logs has no bearing on customer_pricing_rules' own RLS),
  // but it's always attempted, never silently skipped.
  try {
    await supabase.from("audit_logs").insert({
      actor_id: actorId,
      actor_email: actorEmail || null,
      action,
      target_id: null,
      target_email: null,
      details: { company_id: companyId, company_name: companyName, ...details },
    });
  } catch (e) {
    console.warn("Failed to write audit log for customer pricing rule change:", e);
  }
}

export function useSaveCustomerPricingRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CustomerPricingRuleInput & { companyName?: string }) => {
      if (!user) throw new Error("Must be signed in.");
      const { companyName, ...rest } = input;
      const { data, error } = await supabase
        .from("customer_pricing_rules")
        .insert({ ...rest, discount_type: "percent", created_by: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog("customer_pricing_rule_created", user.id, user.email, input.company_id, companyName, {
        discount_percent: input.discount_percent,
        effective_from: input.effective_from,
        effective_until: input.effective_until || null,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateCustomerPricingRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      companyId,
      companyName,
    }: {
      id: string;
      updates: Partial<CustomerPricingRuleInput>;
      companyId: string;
      companyName?: string;
    }) => {
      if (!user) throw new Error("Must be signed in.");
      const { error } = await supabase.from("customer_pricing_rules").update(updates).eq("id", id);
      if (error) throw new Error(error.message);

      await writeAuditLog("customer_pricing_rule_updated", user.id, user.email, companyId, companyName, updates as Record<string, unknown>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Never a hard delete — flips is_active false, audited the same as any other change. */
export function useDeactivateCustomerPricingRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, companyId, companyName }: { id: string; companyId: string; companyName?: string }) => {
      if (!user) throw new Error("Must be signed in.");
      const { error } = await supabase.from("customer_pricing_rules").update({ is_active: false }).eq("id", id);
      if (error) throw new Error(error.message);

      await writeAuditLog("customer_pricing_rule_deactivated", user.id, user.email, companyId, companyName, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useReactivateCustomerPricingRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, companyId, companyName }: { id: string; companyId: string; companyName?: string }) => {
      if (!user) throw new Error("Must be signed in.");
      const { error } = await supabase.from("customer_pricing_rules").update({ is_active: true }).eq("id", id);
      if (error) throw new Error(error.message);

      await writeAuditLog("customer_pricing_rule_updated", user.id, user.email, companyId, companyName, { reactivated: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
