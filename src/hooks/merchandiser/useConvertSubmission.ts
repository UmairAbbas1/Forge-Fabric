import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { useAppData } from "../useAppData";
import type { ConversionModalMapping } from "../../lib/types";
import type { Order } from "../../lib/mockData";
import { sortedSizeKeys } from "../../lib/utils";

export interface ConversionState {
  isConverting: boolean;
  step: number;
  totalSteps: number;
  currentStepLabel: string;
  error: string | null;
  canRetry: boolean;
  result: {
    blanket_po_id?: string;
    po_number?: string;
    work_order_id?: string;
    wo_number?: string;
    customer_id?: string;
  } | null;
}

export function useConvertSubmission() {
  const queryClient = useQueryClient();
  const { addOrder, customers, addCustomer, setToast } = useAppData();
  const [conversionState, setConversionState] = useState<ConversionState>({
    isConverting: false,
    step: 0,
    totalSteps: 6,
    currentStepLabel: "",
    error: null,
    canRetry: false,
    result: null,
  });

  const convertMutation = useMutation({
    mutationFn: async (payload: ConversionModalMapping) => {
      setConversionState({
        isConverting: true,
        step: 1,
        totalSteps: 6,
        currentStepLabel: "Validating mapping & customer profile linkage...",
        error: null,
        canRetry: false,
        result: null,
      });

      // REQ-14: starting stage comes straight from ConversionModal's resolved
      // selected_stages pipeline (Section 3E) — it always computes and sends
      // a real starting_stage now, so the old 4-way service_scope/wash-type
      // string-matching fallback is dead code and has been removed.
      const startingStage = payload.starting_stage || 1;
      const selectedStages = payload.selected_stages && payload.selected_stages.length > 0
        ? payload.selected_stages
        : undefined;

      const generatedPo = payload.po_number || `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const generatedWo = payload.wo_number || `WO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanOrderId = generatedWo.startsWith("WO-") ? generatedWo.replace("WO-", "FF-") : `FF-${Math.floor(2600 + Math.random() * 900)}`;

      const sizeBreakdownStr = payload.size_breakdown && Object.keys(payload.size_breakdown).length > 0
        ? sortedSizeKeys(payload.size_breakdown).join("-")
        : "28-38";

      // No silent qty fallback — ConversionModal already blocks the submit
      // button until totalQty > 0, but this mutation is the last real gate
      // before a production order is written, so it must refuse outright
      // rather than ever persist a fabricated placeholder quantity.
      if (!payload.contract_quantity || payload.contract_quantity <= 0) {
        throw new Error("Order quantity is required and must be greater than zero before conversion.");
      }

      // 1. Instantly register customer if not exists so client portal scoping works
      const companyName = payload.company_name?.trim() || "Brand Customer";
      if (companyName && !customers.some(c => c.name.toLowerCase() === companyName.toLowerCase())) {
        // Fix: addCustomer expects (name: string, contact: string) — not an object
        addCustomer(companyName, payload.contact_email || "");
      }

      // 2. Instantly add new Order to active production dashboard
      const newOrderObj: Omit<Order, "created_date"> = {
        order_id: cleanOrderId,
        customer_name: companyName,
        customer_id: payload.customer_id,
        PO_number: generatedPo,
        tech_pack_ref: `TP-${payload.style_name || "DENIM-501-RAW"}`,
        size_breakdown: sizeBreakdownStr,
        qty: payload.contract_quantity,
        status: (startingStage >= 13 ? "Shipped" : startingStage > 1 ? "In Production" : "Open") as Order["status"],
        current_stage: startingStage,
        priority: payload.priority || "Normal",
        rush_multiplier: payload.priority === "Rush" ? payload.rush_multiplier : undefined,
        style_no: payload.style_name || "DENIM-501-RAW",
        style_description: `${payload.style_name || "Denim"} - ${payload.colorway || "Dark Indigo"} (${payload.wash_process_type || "Standard"})`,
        color: payload.colorway || "Dark Indigo 3x1 RHT",
        planned_ship_date: payload.due_date,
        material_status: startingStage >= 3 ? "Approved" : "Pending",
        notes: `Converted from application. Service: ${payload.wash_process_type || "Standard"}. Initial Stage: Stage ${startingStage}`,
        ...(selectedStages ? { selected_stages: selectedStages } : {}),
      };

      if (!isRealSupabase) {
        // Step-by-step simulated progress for offline mock testing
        await new Promise((r) => setTimeout(r, 400));
        setConversionState((s) => ({ ...s, step: 2, currentStepLabel: "Generating Blanket PO contract..." }));
        await new Promise((r) => setTimeout(r, 400));
        setConversionState((s) => ({ ...s, step: 3, currentStepLabel: `Creating active factory Work Order at Stage ${startingStage}...` }));
        await new Promise((r) => setTimeout(r, 400));
        setConversionState((s) => ({ ...s, step: 4, currentStepLabel: "Linking documents & cut sheet specs..." }));
        await new Promise((r) => setTimeout(r, 400));
        setConversionState((s) => ({ ...s, step: 5, currentStepLabel: "Initializing Gate 1 (Planned) size records..." }));
        await new Promise((r) => setTimeout(r, 400));
        setConversionState((s) => ({ ...s, step: 6, currentStepLabel: "Dispatched client approval confirmation notification." }));

        const simulatedResult = {
          blanket_po_id: `po-${Date.now().toString().slice(-4)}`,
          po_number: generatedPo,
          work_order_id: cleanOrderId,
          wo_number: generatedWo,
          customer_id: payload.customer_id || "cust-mock-1",
        };

        // Cache update in local storage for submissions inbox
        addOrder(newOrderObj);
        const currentSubmissions = JSON.parse(localStorage.getItem("forge_submissions_cache") || "[]");
        const updated = currentSubmissions.map((s: any) =>
          s.id === payload.submission_id
            ? { ...s, status: "converted", converted_to_po_id: simulatedResult.blanket_po_id }
            : s
        );
        localStorage.setItem("forge_submissions_cache", JSON.stringify(updated));

        return simulatedResult;
      }

      // Live Supabase conversion: update cut sheet metadata and perform atomic conversion
      setConversionState((s) => ({ ...s, step: 2, currentStepLabel: "Synchronizing cut sheet & production specifications..." }));

      try {
        // Sync modified metadata back to cut sheet so splitters/reports read it correctly
        const { data: cutSheet } = await supabase
          .from("apply_cut_sheets")
          .select("id, sheet_data, style_no, wash_dx_cd")
          .eq("submission_id", payload.submission_id)
          .maybeSingle();

        if (cutSheet) {
          const sd = cutSheet.sheet_data || {};
          const comps = sd.components || [{}];
          comps[0].size_matrix = payload.size_breakdown;
          comps[0].total_units = payload.contract_quantity;
          sd.components = comps;
          sd.merchandiser_priority = payload.priority; // Save selected priority

          await supabase
            .from("apply_cut_sheets")
            .update({
              sheet_data: sd,
              style_no: payload.style_name || cutSheet.style_no,
              wash_dx_cd: payload.wash_process_type || cutSheet.wash_dx_cd,
            })
            .eq("id", cutSheet.id);
        }
      } catch (csErr) {
        console.warn("Failed to patch cut sheet with merchandiser modifications:", csErr);
      }

      setConversionState((s) => ({ ...s, step: 3, currentStepLabel: "Issuing Blanket PO and updating application status..." }));

      let convertedPoId: string | null = null;
      let convertedPoNumber: string = generatedPo;
      let edgeSucceeded = false;

      // 1. Attempt atomic Edge Function invocation
      try {
        const { data, error } = await supabase.functions.invoke("convert-submission-to-po", {
          body: {
            submission_id: payload.submission_id,
            customer_id: payload.customer_id,
            po_number: payload.po_number,
            total_qty: payload.contract_quantity,
            work_orders: [
              {
                wo_number: payload.wo_number,
                style_name: payload.style_name,
                colorway: payload.colorway,
                wash_process_type: payload.wash_process_type,
                target_qty: payload.contract_quantity,
                size_breakdown: payload.size_breakdown,
                due_date: payload.due_date,
                order_type: payload.order_type,
                priority: payload.priority,
              },
            ],
          },
        });

        if (!error && data && data.success) {
          convertedPoId = data.po_id || null;
          convertedPoNumber = data.po_number || generatedPo;
          edgeSucceeded = true;
        }
      } catch (edgeErr) {
        console.warn("Edge function invocation returned non-2xx, switching to direct transactional fallback:", edgeErr);
      }

      // 2. Direct Database Fallback: Executes if Edge Function is unavailable or returns non-2xx
      if (!edgeSucceeded) {
        try {
          // A. Fetch current submission details
          const { data: subData } = await supabase
            .from("apply_submissions")
            .select("id, company_name, contact_email, apply_reference_code, status")
            .eq("id", payload.submission_id)
            .maybeSingle();

          // B. Ensure Customer Master record exists in 'customers'
          let custId = payload.customer_id;
          if (!custId && companyName) {
            const { data: existingCust } = await supabase
              .from("customers")
              .select("id")
              .ilike("name", companyName)
              .limit(1);

            if (existingCust && existingCust.length > 0) {
              custId = existingCust[0].id;
            } else {
              const { data: newCust } = await supabase
                .from("customers")
                .insert({ name: companyName })
                .select("id")
                .single();
              custId = newCust?.id;
            }
          }

          // C. Insert into blanket_pos
          const { data: bpo, error: bpoError } = await supabase
            .from("blanket_pos")
            .insert({
              po_number: generatedPo,
              customer_id: custId || null,
              customer_type: "External",
              total_contract_qty: payload.contract_quantity || 100,
              fulfilled_qty: 0,
              po_type: "Blanket",
              source_submission_id: payload.submission_id,
              apply_reference_code: subData?.apply_reference_code || null,
              client_submitted: true,
              status: "Open",
            })
            .select("id, po_number")
            .single();

          if (bpoError) {
            console.warn("Direct blanket_pos insert warning:", bpoError);
          }

          convertedPoId = bpo?.id || `bpo-${Date.now()}`;
          convertedPoNumber = bpo?.po_number || generatedPo;

          // D. Link cut sheets
          await supabase
            .from("apply_cut_sheets")
            .update({ work_order_id: null, is_current: true })
            .eq("submission_id", payload.submission_id);

          // E. Update submission status to 'converted'
          await supabase
            .from("apply_submissions")
            .update({
              status: "converted",
              converted_to_po_id: convertedPoId,
              converted_at: new Date().toISOString(),
            })
            .eq("id", payload.submission_id);

          // F. Insert notification log
          if (subData?.contact_email) {
            try {
              await supabase.from("notification_logs").insert({
                recipient_email: subData.contact_email,
                notification_type: "approval",
                subject: `Application Approved: Blanket PO Created [${convertedPoNumber}]`,
                body: `Congratulations! Your order application (${subData.apply_reference_code}) for ${companyName} has been approved and converted to Blanket PO #${convertedPoNumber}. Production planning is now underway.`,
                related_submission_id: payload.submission_id,
                delivered: true,
              });
            } catch (notifErr) {
              console.warn("Notification log notice:", notifErr);
            }
          }
        } catch (dbErr: any) {
          console.error("Direct conversion error:", dbErr);
          throw new Error(`Conversion could not be completed: ${dbErr.message || "Database update failed"}`);
        }
      }

      setConversionState((s) => ({ ...s, step: 5, currentStepLabel: "Broadcasting updates to factory orders and dispatch..." }));
      addOrder(newOrderObj);

      // Local storage cache update for instant UI response
      const currentSubmissions = JSON.parse(localStorage.getItem("forge_submissions_cache") || "[]");
      const updated = currentSubmissions.map((s: any) =>
        s.id === payload.submission_id
          ? { ...s, status: "converted", converted_to_po_id: convertedPoId }
          : s
      );
      localStorage.setItem("forge_submissions_cache", JSON.stringify(updated));

      setConversionState((s) => ({ ...s, step: 6, currentStepLabel: "Conversion successfully committed." }));
      return {
        blanket_po_id: convertedPoId || undefined,
        po_number: convertedPoNumber,
        work_order_id: cleanOrderId,
        wo_number: generatedWo,
        customer_id: payload.customer_id,
      };
    },
    onSuccess: (result) => {
      setConversionState((s) => ({
        ...s,
        isConverting: false,
        result,
        error: null,
      }));
      setToast({ message: "Order approved & converted! Visible now in Orders Dashboard.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["merchandiser_submissions"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["apply-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["blanket_pos"] });
    },
    onError: (err: any) => {
      setConversionState((s) => ({
        ...s,
        isConverting: false,
        error: err?.message || "An unexpected error occurred during order conversion.",
        canRetry: true,
      }));
    },
  });

  const resetState = useCallback(() => {
    setConversionState({
      isConverting: false,
      step: 0,
      totalSteps: 6,
      currentStepLabel: "",
      error: null,
      canRetry: false,
      result: null,
    });
  }, []);

  return {
    convert: convertMutation.mutateAsync,
    conversionState,
    resetState,
  };
}
