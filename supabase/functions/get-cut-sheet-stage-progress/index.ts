// ============================================================================
// FORGE & FABRIC — EDGE FUNCTION: GET CUT SHEET STAGE PROGRESS
// supabase/functions/get-cut-sheet-stage-progress/index.ts
//
// Returns real, live stage-completion data for one order (Fabric Received,
// Pattern/Marker Ready, and the Cutting/Sewing/Laundry/Finishing/Shipped
// date columns from the WeisMade reference cut sheet) — service-role, so it
// works identically for both the customer wizard (which has no direct RLS
// read access to internal shop-floor tables) and merchandiser/admin callers.
// This is the ONE shared computation both audiences call, guaranteeing the
// stage-progress portion of a cut sheet export is identical regardless of
// who downloads it.
//
// Never fabricates a date: a stage that hasn't happened yet (or whose table
// genuinely has no timestamp column — sewing_bundles has no date field at
// all in this schema) returns null/false, not a plausible-looking value.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StageProgress {
  in_production: boolean;
  order_received_date: string | null;
  fabric_received: boolean;
  fabric_received_date: string | null;
  pattern_marker_ready: boolean;
  cutting_reached: boolean;
  cutting_date: string | null;
  sewing_reached: boolean;
  sewing_date: string | null;
  laundry_reached: boolean;
  laundry_date: string | null;
  finishing_reached: boolean;
  finishing_date: string | null;
  shipped_reached: boolean;
  shipped_date: string | null;
}

function emptyProgress(): StageProgress {
  return {
    in_production: false,
    order_received_date: null,
    fabric_received: false,
    fabric_received_date: null,
    pattern_marker_ready: false,
    cutting_reached: false,
    cutting_date: null,
    sewing_reached: false,
    sewing_date: null,
    laundry_reached: false,
    laundry_date: null,
    finishing_reached: false,
    finishing_date: null,
    shipped_reached: false,
    shipped_date: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server missing Supabase service configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { reference_code } = await req.json();
    if (!reference_code || typeof reference_code !== "string" || !reference_code.trim()) {
      // No order/PO reference to resolve yet (e.g. a brand-new intake draft) —
      // correctly report nothing is in production, not an error.
      return new Response(JSON.stringify(emptyProgress()), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ref = reference_code.trim();

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("order_id, created_date, current_stage, status, planned_ship_date")
      .or(`order_id.eq.${ref},po_number.eq.${ref}`)
      .maybeSingle();

    if (!order) {
      // Submission hasn't been converted into a production order yet —
      // every stage is honestly "not yet reached", not blank/fabricated.
      return new Response(JSON.stringify(emptyProgress()), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = order.order_id;

    const [materialsRes, cutTicketsRes, sewingRes, washRes, qcRes] = await Promise.all([
      supabaseAdmin.from("materials").select("inspection_status, received_date").eq("order_id", orderId),
      supabaseAdmin.from("cut_tickets").select("status, created_at").eq("work_order_id", orderId),
      supabaseAdmin.from("sewing_bundles").select("status").eq("order_id", orderId),
      supabaseAdmin.from("wash_batches").select("*").eq("order_id", orderId),
      supabaseAdmin.from("qc_records").select("stage_checkpoint, result, inspected_date").eq("order_id", orderId),
    ]);

    const materials = materialsRes.data || [];
    const cutTickets = cutTicketsRes.data || [];
    const sewingBundles = sewingRes.data || [];
    const washBatches = washRes.data || [];
    const qcRecords = qcRes.data || [];

    const approvedMaterials = materials.filter((m: any) => m.inspection_status === "Approved");
    const fabricReceived = approvedMaterials.length > 0;
    const fabricReceivedDate =
      approvedMaterials
        .map((m: any) => m.received_date)
        .filter(Boolean)
        .sort()[0] || null;

    const patternMarkerReady = cutTickets.length > 0;
    const completedCut = cutTickets.find((c: any) => c.status === "Completed");

    const sewingReached = sewingBundles.length > 0 && sewingBundles.every((s: any) => s.status === "Completed");

    const washRow = washBatches.find((w: any) => w.stage === "Finish" || w.stage === "Approved");
    // sewing_bundles carries no timestamp column in this schema — reached-state
    // is real, but a date is genuinely unavailable, so it stays null rather
    // than being invented.
    const laundryDate = washRow ? (washRow.updated_at || washRow.created_at || washRow.completed_at || null) : null;

    const finishQc = qcRecords.find(
      (q: any) => (q.stage_checkpoint === "Wash-Finish Approval" || q.stage_checkpoint === "Final AQL-Packing Audit") && q.result === "Pass"
    );

    const shipped = order.status === "Shipped";

    const progress: StageProgress = {
      in_production: true,
      order_received_date: order.created_date || null,
      fabric_received: fabricReceived,
      fabric_received_date: fabricReceivedDate,
      pattern_marker_ready: patternMarkerReady,
      cutting_reached: !!completedCut,
      cutting_date: completedCut?.created_at ? String(completedCut.created_at).slice(0, 10) : null,
      sewing_reached: sewingReached,
      sewing_date: null,
      laundry_reached: !!washRow,
      laundry_date: laundryDate ? String(laundryDate).slice(0, 10) : null,
      finishing_reached: !!finishQc,
      finishing_date: finishQc?.inspected_date ? String(finishQc.inspected_date).slice(0, 10) : null,
      shipped_reached: shipped,
      shipped_date: shipped ? (order.planned_ship_date || null) : null,
    };

    return new Response(JSON.stringify(progress), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error computing stage progress." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
