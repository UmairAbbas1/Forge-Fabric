// ============================================================================
// FORGE & FABRIC — EDGE FUNCTION: OUTSOURCING PORTAL
// supabase/functions/outsourcing-portal/index.ts
//
// Backs the no-login /outsourcing?token=... page. Field/vendor-site staff
// open a link — no Supabase Auth session, no profiles row, nothing that
// satisfies is_internal_staff() — so every table this touches
// (orders, stage_outsourcing_records, outsource_return_qc) stays exactly as
// RLS-locked as it is today; this function alone holds the service-role key
// and is the only door in. Authorization is a single shared secret
// (OUTSOURCING_PORTAL_TOKEN) compared against the `token` the page sends on
// every call, not a per-user identity — logged actions are attributed by a
// free-text name the page asks the visitor to type once, not a real user id.
//
// Deliberately does NOT expose Return QC or "accept shortage as final" —
// both are judgment/authorization calls that stay behind a real staff login
// (StageOutsourcingPanel, unchanged). This function only covers the routine
// "material went out / material came back" logging the link is actually for.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const STAGE_FRIENDLY_NAMES: Record<number, string> = {
  1: "Fabric Receiving & Inspection",
  2: "Fabric Receiving & Inspection",
  3: "Fabric Receiving & Inspection",
  4: "Pre-Production Planning",
  5: "Cutting & Bundling",
  6: "Cutting & Bundling",
  7: "Sewing Assembly",
  8: "Pre-Wash Quality Check",
  9: "Washing & Laundry",
  10: "Finishing & Effects",
  11: "Final Quality Inspection",
  12: "Pressing, Tagging & Packing",
  13: "Dispatch & Delivery",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const portalToken = Deno.env.get("OUTSOURCING_PORTAL_TOKEN") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Server missing Supabase service configuration." }, 500);
    }
    if (!portalToken) {
      return json({ error: "This link is not configured yet. Ask an admin to set OUTSOURCING_PORTAL_TOKEN." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { token, action, payload } = body as { token?: string; action?: string; payload?: any };

    if (!token || token !== portalToken) {
      return json({ error: "Invalid or missing access link. Ask your manager for the correct link." }, 401);
    }
    if (!action) {
      return json({ error: "Missing action." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (action === "list_orders") {
      const { data, error } = await admin
        .from("orders")
        .select("order_id, customer_name, style_no, current_stage, status, selected_stages")
        .order("created_date", { ascending: false })
        .limit(300);
      if (error) return json({ error: error.message }, 500);
      return json({ orders: data || [] });
    }

    if (action === "list_records") {
      const orderId = payload?.order_id;
      if (!orderId) return json({ error: "order_id is required." }, 400);
      const { data, error } = await admin
        .from("stage_outsourcing_records")
        .select("*")
        .eq("order_id", orderId)
        .order("dispatched_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ records: data || [] });
    }

    if (action === "dispatch") {
      const p = payload || {};
      const required = ["order_id", "stage_number", "vendor_name", "outsource_po_number", "quantity_dispatched", "material_type", "logged_by_name"];
      const missing = required.filter((k) => p[k] === undefined || p[k] === null || p[k] === "");
      if (missing.length > 0) return json({ error: `Missing required field(s): ${missing.join(", ")}` }, 400);
      if (Number(p.quantity_dispatched) <= 0) return json({ error: "Quantity dispatched must be greater than 0." }, 400);

      const { error } = await admin.from("stage_outsourcing_records").insert({
        order_id: p.order_id,
        stage_number: p.stage_number,
        stage_name: STAGE_FRIENDLY_NAMES[p.stage_number] ?? `Stage ${p.stage_number}`,
        vendor_name: p.vendor_name,
        vendor_facility_location: p.vendor_facility_location || null,
        outsource_po_number: p.outsource_po_number,
        quantity_dispatched: p.quantity_dispatched,
        material_type: p.material_type,
        material_description: p.material_description || null,
        notes: p.notes || null,
        transport_method: p.transport_method || null,
        vehicle_reference: p.vehicle_reference || null,
        driver_carrier_name: p.driver_carrier_name || null,
        vendor_status: "Dispatched",
        return_qc_status: "Pending",
        dispatched_by_name: p.logged_by_name,
        logged_by: p.logged_by_name,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "receive") {
      const p = payload || {};
      if (!p.record_id || p.quantity_received === undefined || !p.received_by_name) {
        return json({ error: "record_id, quantity_received, and received_by_name are required." }, 400);
      }

      const { data: record, error: fetchErr } = await admin
        .from("stage_outsourcing_records")
        .select("id, order_id, stage_number, quantity_dispatched")
        .eq("id", p.record_id)
        .maybeSingle();
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!record) return json({ error: "Outsourcing record not found." }, 404);

      const qtyReceived = Number(p.quantity_received);
      if (qtyReceived < 0) return json({ error: "Quantity received cannot be negative." }, 400);
      if (qtyReceived > record.quantity_dispatched) {
        return json({ error: `Quantity received (${qtyReceived}) cannot exceed quantity dispatched (${record.quantity_dispatched}).` }, 400);
      }
      const vendorStatus = qtyReceived >= record.quantity_dispatched ? "Returned_Complete" : "Returned_Partial";

      const { error: updateErr } = await admin
        .from("stage_outsourcing_records")
        .update({
          quantity_received: qtyReceived,
          received_at: new Date().toISOString(),
          received_by_name: p.received_by_name,
          vendor_status: vendorStatus,
          shortage_resolved: false,
          shortage_resolution_reason: null,
          shortage_resolved_by: null,
          shortage_resolved_at: null,
        })
        .eq("id", p.record_id);
      if (updateErr) return json({ error: updateErr.message }, 500);

      const { error: qcErr } = await admin.from("outsource_return_qc").insert({
        outsource_record_id: record.id,
        order_id: record.order_id,
        stage_number: record.stage_number,
        inspector_name: "Pending Assignment",
        inspected_qty: 0,
        result: "Pending",
      });
      if (qcErr) return json({ error: qcErr.message }, 500);

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    return json({ error: err?.message || "Internal server error in outsourcing portal." }, 500);
  }
});
