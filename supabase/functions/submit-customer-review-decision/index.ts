import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

// Customer-facing counterpart to approve-reject-submission — that function
// implicitly trusts any authenticated caller (staff-only in practice because
// only staff UI ever calls it), but this one is invoked directly by a
// customer reviewing a merchandiser-created (Internal Order Intake)
// submission, so it verifies the caller's own identity and company against
// the submission before doing anything, then uses the service-role client
// for the actual privileged writes (orders/blanket_pos are staff-write-only
// under RLS, and convert_submission_to_blanket_po is SECURITY INVOKER).

interface DecisionPayload {
  submission_id: string;
  action: 'approve' | 'reject';
  reason?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Resolve the real caller identity from their own JWT — this function
    // grants elevated (service-role) write access on their behalf, so it
    // cannot rely on the client merely claiming who it is.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: could not verify caller identity' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('id, role, company_id, email, full_name')
      .eq('id', callerData.user.id)
      .single();

    if (profileErr || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Caller profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (callerProfile.role !== 'customer' || !callerProfile.company_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: this endpoint is for customer submission reviews only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerCompany } = await serviceClient
      .from('companies')
      .select('name')
      .eq('id', callerProfile.company_id)
      .single();

    const payload: DecisionPayload = await req.json();
    if (!payload.submission_id || typeof payload.submission_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation failed: submission_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!payload.action || !['approve', 'reject'].includes(payload.action)) {
      return new Response(
        JSON.stringify({ error: "Validation failed: action must be 'approve' or 'reject'." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (payload.action === 'reject' && (!payload.reason || !payload.reason.trim() || payload.reason.length > 500)) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: reason is required for rejection (max 500 chars).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: submission, error: subError } = await serviceClient
      .from('apply_submissions')
      .select('*')
      .eq('id', payload.submission_id)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: `Submission not found: ${subError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ownsSubmission = callerCompany?.name && submission.company_name &&
      callerCompany.name.trim().toLowerCase() === submission.company_name.trim().toLowerCase();
    if (!ownsSubmission) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: this submission does not belong to your company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (submission.status !== 'pending_customer_review') {
      return new Response(
        JSON.stringify({ error: `Conflict: this submission is not awaiting your review (current status: ${submission.status}).` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve the originating merchandiser's email so they can be notified
    // of the outcome — required for both branches below.
    let merchandiserEmail: string | null = null;
    let merchandiserName = 'Team Member';
    if (submission.created_by_staff_id) {
      const { data: staffProfile } = await serviceClient
        .from('profiles')
        .select('email, full_name')
        .eq('id', submission.created_by_staff_id)
        .maybeSingle();
      if (staffProfile) {
        merchandiserEmail = staffProfile.email;
        merchandiserName = staffProfile.full_name || 'Team Member';
      }
    }

    if (payload.action === 'reject') {
      const { error: rejectError } = await serviceClient
        .from('apply_submissions')
        .update({
          status: 'customer_rejected',
          rejection_reason: payload.reason,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.submission_id);

      if (rejectError) {
        return new Response(
          JSON.stringify({ error: `Failed to record rejection: ${rejectError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (merchandiserEmail) {
        await serviceClient.from('notification_logs').insert({
          recipient_email: merchandiserEmail,
          notification_type: 'customer_rejected_intake',
          subject: `Customer requested changes: ${submission.apply_reference_code || submission.id}`,
          body: `Dear ${merchandiserName},\n\n${submission.company_name} reviewed the order you submitted on their behalf (${submission.apply_reference_code}) and requested changes rather than approving it.\n\nReason: ${payload.reason}\n\nPlease revise the details and resend it for their review.`,
          related_submission_id: payload.submission_id,
          sent_at: new Date().toISOString(),
          delivered: true,
          opened: false,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          submission_id: payload.submission_id,
          action: 'reject',
          status: 'customer_rejected',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Approve — reuses the exact same conversion RPC the staff approval path
    // calls (convert_submission_to_blanket_po), unmodified. The PO number
    // must be a real merchandiser-supplied reference captured at intake
    // time (existing_order_reference) — this codebase deliberately never
    // synthesizes PO numbers (see ConversionModal's own required-field
    // validation), and useApplySubmission.ts only routes a submission into
    // pending_customer_review when this field is already present, so this
    // should never be empty here — but it's still a hard, honest failure
    // rather than a silent fallback if it somehow is.
    if (!submission.existing_order_reference || !submission.existing_order_reference.trim()) {
      return new Response(
        JSON.stringify({ error: 'This submission is missing a required PO reference and cannot be approved yet. Please contact your merchandiser.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
      'convert_submission_to_blanket_po',
      {
        p_submission_id: payload.submission_id,
        p_custom_po_number: submission.existing_order_reference,
        p_override_total_qty: null,
      }
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Atomic conversion failed: ${rpcError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the real, pipeline-visible order at stage 1 — mirrors exactly
    // what useConvertSubmission's addOrder() does for a staff-approved
    // conversion, since the RPC above only creates the Blanket PO record.
    const mainStyle = (Array.isArray(submission.style_blocks) && submission.style_blocks[0]) || {};
    const { data: cutSheet } = await serviceClient
      .from('apply_cut_sheets')
      .select('sheet_data, style_no, wash_dx_cd')
      .eq('submission_id', payload.submission_id)
      .maybeSingle();

    const sizeBreakdown: Record<string, number> =
      mainStyle.size_matrix && Object.keys(mainStyle.size_matrix).length > 0
        ? mainStyle.size_matrix
        : cutSheet?.sheet_data?.components?.[0]?.size_matrix || {};
    const totalQty = Object.values(sizeBreakdown).reduce((sum: number, v) => sum + (Number(v) || 0), 0)
      || submission.estimated_quantity
      || 0;

    const woNumber = `WO-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
    const orderId = `FF-${Math.floor(2000 + Math.random() * 7999)}`;

    const { error: orderInsertError } = await serviceClient.from('orders').insert({
      order_id: orderId,
      customer_name: submission.company_name,
      po_number: rpcResult?.po_number || submission.existing_order_reference,
      tech_pack_ref: `TP-${mainStyle.style_name || mainStyle.style_number || submission.apply_reference_code}`,
      size_breakdown: Object.keys(sizeBreakdown).length > 0
        ? Object.entries(sizeBreakdown).map(([k]) => k).sort().join('-')
        : null,
      qty: totalQty,
      status: 'Open',
      current_stage: 1,
      created_date: new Date().toISOString(),
      style_no: mainStyle.style_number || mainStyle.style_name || cutSheet?.style_no || null,
      style_description: mainStyle.style_name || null,
      color: mainStyle.colorway || null,
      planned_ship_date: submission.planned_ship_date || null,
      material_status: 'Pending',
      notes: `Converted from Internal Order Intake submission ${submission.apply_reference_code}, approved by customer.`,
      ...(Array.isArray(submission.requested_stages) && submission.requested_stages.length > 0
        ? { selected_stages: submission.requested_stages }
        : {}),
      ...(submission.priority ? { priority: submission.priority } : {}),
      ...(submission.rush_multiplier ? { rush_multiplier: submission.rush_multiplier } : {}),
    });

    if (orderInsertError) {
      // The blanket PO + submission status are already committed by the RPC
      // at this point — surface this clearly rather than pretending nothing
      // happened, since a merchandiser will need to manually create the
      // work order from the Blanket PO in this edge case.
      return new Response(
        JSON.stringify({
          error: `Order approved and Blanket PO ${rpcResult?.po_number} created, but the production order record failed to save: ${orderInsertError.message}. Contact your merchandiser to complete setup.`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (merchandiserEmail) {
      await serviceClient.from('notification_logs').insert({
        recipient_email: merchandiserEmail,
        notification_type: 'customer_approved_intake',
        subject: `Customer approved: ${submission.apply_reference_code || submission.id}`,
        body: `Dear ${merchandiserName},\n\n${submission.company_name} approved the order you submitted on their behalf (${submission.apply_reference_code}). It has been converted to Blanket PO ${rpcResult?.po_number} and Order ${orderId}, now active in the production pipeline at Stage 1.`,
        related_submission_id: payload.submission_id,
        sent_at: new Date().toISOString(),
        delivered: true,
        opened: false,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: payload.submission_id,
        action: 'approve',
        status: 'converted',
        po_number: rpcResult?.po_number,
        order_id: orderId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing customer review decision' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
