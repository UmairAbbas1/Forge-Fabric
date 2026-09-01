import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { StyleBlockItem } from "../contexts/ApplyWizardContext";

export interface StyleTemplate {
  id: string;
  company_id: string | null;
  created_by_user_id: string | null;
  template_name: string;
  style_block: StyleBlockItem;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["style_templates"];

/**
 * Templates visible to the current session — RLS (style_templates_staff_all /
 * style_templates_customer_own, see the style_templates migration) already
 * scopes this correctly: staff see every template (any colleague's saved
 * configuration is useful), a customer sees only their own company's. No
 * client-side filtering needed or trustworthy for the real boundary.
 */
export function useStyleTemplates() {
  const { user } = useAuth();
  const enabled = !!user && isRealSupabase;

  return useQuery({
    queryKey: QUERY_KEY,
    enabled,
    queryFn: async (): Promise<StyleTemplate[]> => {
      const { data, error } = await supabase
        .from("style_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export function useSaveStyleTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ templateName, styleBlock }: { templateName: string; styleBlock: StyleBlockItem }) => {
      if (!user) throw new Error("Must be signed in to save a template.");
      const isStaff = user.role && user.role !== "customer";

      // Strip the id/is-default/lineage fields that are meaningless outside
      // the specific order they came from — a template is a reusable
      // starting point, not a copy of one particular line's identity.
      const { id, wash_type_is_default, ...reusableSpec } = styleBlock as any;

      const { error } = await supabase.from("style_templates").insert({
        company_id: isStaff ? null : (user.company_id || null),
        created_by_user_id: isStaff ? user.id : null,
        template_name: templateName,
        style_block: reusableSpec,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
