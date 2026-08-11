import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { useAppData } from "./useAppData";
import type { ApplySubmission, BlanketPO, WorkOrder, MerchandiserAssignment } from "../lib/types";

export function useConvertSubmission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addOrder } = useAppData();
  const isRealSupabase = isSupabaseConfigured();

  const convertMutation = useMutation({
    mutationFn: async ({
      submission,
      assignedMerchandiserId,
      facility = "Sewing Facility",
    }: {
      submission: ApplySubmission;
      assignedMerchandiserId?: string;
      facility?: "Sewing Facility" | "Laundry Facility";
    }) => {
      const subAny = submission as any;
      const merchandiserId = assignedMerchandiserId || user?.id || "merch-auto-assigned";
      const newOrderId = `FF-${Math.floor(2600 + Math.random() * 900)}`;
      const orderQty = subAny.quantities?.total_units || 1000;
      const startingStage = subAny.starting_stage || 
        (subAny.service_scope === 'wash_only' ? 9 : 
         subAny.service_scope === 'sew_only' ? 6 : 
         subAny.service_scope === 'finish_only' ? 12 : 1);

      // 1. Local AppData Sync (Adds order immediately into the in-memory/localStorage orders store)
      addOrder({
        order_id: newOrderId,
        customer_name: submission.company_name || submission.contact_name || "New Client",
        PO_number: submission.apply_reference_code || subAny.reference_code || `PO-${Date.now().toString().slice(-6)}`,
        tech_pack_ref: `TP-${subAny.style_info?.style_number || "STANDARD"}`,
        size_breakdown: "28-38",
        qty: orderQty,
        status: startingStage >= 13 ? "Shipped" : startingStage > 1 ? "In Production" : "Open",
        current_stage: startingStage,
      });

      // 2. Supabase Integration (Using blanket_pos, work_orders, merchandiser_assignments)
      if (isRealSupabase) {
        try {
          // A. Insert Blanket PO with multi-style blocks
          const { data: poData, error: poError } = await supabase
            .from("blanket_pos")
            .insert({
              po_number: submission.apply_reference_code || subAny.reference_code || `PO-${Date.now().toString().slice(-6)}`,
              customer_id: subAny.user_id || user?.id || null,
              assigned_merchandiser_id: merchandiserId,
              total_qty: orderQty,
              total_value: (orderQty * 24.5).toString(),
              status: "Draft",
              product_type: subAny.product_type || 'Denim/Bottoms',
              fabric_type: subAny.fabric_type || 'Woven',
              style_blocks: subAny.style_blocks || [],
              trim_components: subAny.trim_components || [],
            })
            .select()
            .single();

          if (poError) {
            console.warn("Supabase blanket_pos insert warning:", poError.message);
          }

          const blanketPoId = poData?.id || `bpo-${Date.now()}`;

          // B. Insert Work Order
          const { data: woData, error: woError } = await supabase
            .from("work_orders")
            .insert({
              blanket_po_id: blanketPoId,
              wo_number: `WO-${newOrderId}`,
              facility: facility,
              cut_sheet_id: null,
              units: orderQty,
              current_stage_id: startingStage,
              status: "Pending",
              assigned_merchandiser_id: merchandiserId,
            })
            .select()
            .single();

          if (woError) {
            console.warn("Supabase work_orders insert warning:", woError.message);
          }

          // C. Record Merchandiser Assignment
          try {
            await supabase.from("merchandiser_assignments").insert({
              merchandiser_id: merchandiserId,
              submission_id: submission.id,
              blanket_po_id: blanketPoId,
              status: "active",
            });
          } catch (assignErr) {
            console.warn("Merchandiser assignment insert fallback:", assignErr);
          }

          // D. Update Submission Status to 'approved'
          await supabase
            .from("apply_submissions")
            .update({
              status: "approved",
              assigned_merchandiser_id: merchandiserId,
              converted_to_po_id: blanketPoId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", submission.id);

        } catch (supabaseErr) {
          console.warn("Supabase convert workflow handled gracefully:", supabaseErr);
        }
      }

      return {
        orderId: newOrderId,
        status: "success",
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries so everything refreshes instantly
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["blanket_pos"] });
      queryClient.invalidateQueries({ queryKey: ["apply_submissions"] });
    },
  });

  return {
    convertSubmission: convertMutation.mutateAsync,
    isConverting: convertMutation.isPending,
  };
}
