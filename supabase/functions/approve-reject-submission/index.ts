import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface DecisionPayload {
  submission_id: string;
  action: 'approve' | 'reject';
  reason?: string;
  po_number?: string;
  total_qty?: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    if (payload.action === 'reject' && (!payload.reason || payload.reason.length > 500)) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: reason is required for rejection (max 500 chars).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: submission, error: subError } = await supabaseClient
      .from('apply_submissions')
      .select('id, company_name, contact_name, contact_email, apply_reference_code, status')
      .eq('id', payload.submission_id)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: `Submission not found: ${subError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (submission.status === 'converted') {
      return new Response(
        JSON.stringify({ error: 'Conflict: This submission has already been converted into a production order.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.action === 'reject') {
      // 1. Mark as rejected
      const { error: rejectError } = await supabaseClient
        .from('apply_submissions')
        .update({
          status: 'rejected',
          internal_notes: `[Rejection Reason: ${new Date().toLocaleDateString()}] ${payload.reason}`,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.submission_id);

      if (rejectError) {
        return new Response(
          JSON.stringify({ error: `Failed to reject submission: ${rejectError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Email client notification
      await supabaseClient.from('notification_logs').insert({
        recipient_email: submission.contact_email,
        notification_type: 'submission_rejected',
        subject: `Update regarding your Forge & Fabric order application (${submission.apply_reference_code})`,
        body: `Dear ${submission.contact_name},\n\nThank you for your order submission. After reviewing your specifications, we are unable to accept this order at this time.\n\nReason: ${payload.reason}\n\nPlease contact your merchandiser if you would like to discuss adjustments.`,
        related_submission_id: payload.submission_id,
        sent_at: new Date().toISOString(),
        delivered: true,
        opened: false,
      });

      return new Response(
        JSON.stringify({
          success: true,
          submission_id: payload.submission_id,
          action: 'reject',
          status: 'rejected',
          message: 'Submission rejected and client notified.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atomic Approval Workflow (Fix #1 & #5): Call transactional convert RPC
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      'convert_submission_to_blanket_po',
      {
        p_submission_id: payload.submission_id,
        p_custom_po_number: payload.po_number || null,
        p_override_total_qty: payload.total_qty || null,
      }
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({
          error: `Atomic conversion failed during approval: ${rpcError.message}. All database operations were rolled back safely.`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success email dispatch
    await supabaseClient.from('notification_logs').insert({
      recipient_email: submission.contact_email,
      notification_type: 'order_converted',
      subject: `Order Approved & Issued: Blanket PO ${rpcResult?.po_number || 'Generated'}`,
      body: `Dear ${submission.contact_name},\n\nYour order application ${submission.apply_reference_code} has been approved and converted to production blanket PO ${rpcResult?.po_number}.\n\nYou can track live cutting, sewing, and wash progress on your Forge & Fabric dashboard.`,
      related_submission_id: payload.submission_id,
      sent_at: new Date().toISOString(),
      delivered: true,
      opened: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: payload.submission_id,
        action: 'approve',
        status: 'converted',
        conversion_result: rpcResult,
        message: 'Order approved and atomically converted to Blanket PO & Work Order.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing decision' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
