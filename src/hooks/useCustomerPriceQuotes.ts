import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface CustomerPriceQuote {
  id: string;
  quote_number: string;
  submission_id: string | null;
  customer_name: string;
  style_name: string;
  quantity: number;
  final_unit_price: number;
  total_contract_value: number;
  status: "Draft" | "Sent_To_Customer" | "Accepted" | "Rejected" | "Expired";
  customer_viewed_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

const QUERY_KEY = ["customer-price-quotes"];

/**
 * All price_quotes visible to the logged-in customer. RLS
 * (price_quotes_customer_select, 20260823000000) already scopes this to
 * their own company — no client-side company filter needed or trustworthy
 * (never rely on client filtering for tenant isolation; see
 * price_quotes_customer_select for the real boundary).
 */
export function useCustomerPriceQuotes() {
  const { user } = useAuth();
  const enabled = !!user && user.role === "customer" && isRealSupabase;

  return useQuery({
    queryKey: QUERY_KEY,
    enabled,
    queryFn: async (): Promise<CustomerPriceQuote[]> => {
      const { data, error } = await supabase
        .from("price_quotes")
        .select(
          "id, quote_number, submission_id, customer_name, style_name, quantity, final_unit_price, total_contract_value, status, customer_viewed_at, accepted_at, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

/** One-time dashboard-tile acknowledgment — does not accept or reject the quote, only dismisses the alert. */
export function useMarkPriceQuoteViewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.rpc("mark_price_quote_viewed", { p_quote_id: quoteId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Accept/Reject for an already-authenticated customer session. Goes through
 * respond_to_price_quote_authenticated (SECURITY DEFINER, scoped by company
 * match — see 20260901001100) rather than a direct client-side
 * price_quotes UPDATE, because the decision also has to propagate to the
 * linked apply_submissions.pricing_status: Accepted tells the merchandiser
 * they can convert to a Work Order, Rejected is what makes the submission
 * disappear from the customer's own Active Production Orders / Active
 * Intake lists (orders.tsx filters on pricing_status === 'Pricing_Rejected').
 * Doing that submission write from the client would depend on a since-
 * flagged-insecure open RLS policy on apply_submissions — the RPC avoids
 * that entirely.
 */
export function useRespondToPriceQuoteAuthenticated() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, response }: { quoteId: string; response: "Accepted" | "Rejected" }) => {
      const { data, error } = await supabase.rpc("respond_to_price_quote_authenticated", {
        p_quote_id: quoteId,
        p_response: response,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // The submission's pricing_status changed too — refresh the
      // merchandiser inbox and the customer's own orders/dashboard lists.
      queryClient.invalidateQueries({ queryKey: ["merchandiser_submissions"] });
    },
  });
}
