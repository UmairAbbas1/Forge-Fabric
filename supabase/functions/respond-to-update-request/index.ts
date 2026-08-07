import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface RespondUpdateRequestPayload {
  request_id: string;
  status: 'submitted' | 'under_review' | 'in_progress' | 'completed' | 'rejected' | 'closed';
  resolution_notes?: string;
  new_cut_sheet_id?: string;
  attachment_urls?: string[];
}

const EMAIL_TEMPLATES: Record<string, { subject: string; bodyGen: (req: any, notes?: string) => string }> = {
  submitted: {
    subject: 'Update Request Received',
    bodyGen: (req) => `We received your update request (${req.request_subject}). Our merchandising team will review it within 24 hours.`,
  },
  under_review: {
    subject: 'Update Request Under Review',
    bodyGen: (req, notes) => `Your update request (${req.request_subject}) is currently under active engineering and pattern review.${notes ? `\n\nNotes from team: ${notes}` : ''}`,
  },
  in_progress: {
    subject: 'Update Request In Progress',
    bodyGen: (req, notes) => `We are actively revising production patterns and specs for your request: ${req.request_subject}.${notes ? `\n\nProgress details: ${notes}` : ''}`,
  },
  completed: {
    subject: 'Update Request Completed & Applied',
    bodyGen: (req, notes) => `Your requested modifications for (${req.request_subject}) have been completed and updated on the factory floor.${notes ? `\n\nResolution: ${notes}` : ''}\n\nYou can view and download your revised cut sheet on your order portal.`,
  },
  rejected: {
    subject: 'Update Request Status: Unable to Accommodate',
    bodyGen: (req, notes) => `We have reviewed your request (${req.request_subject}) but unfortunately cannot accommodate these changes due to current production constraints.${notes ? `\n\nReason: ${notes}` : ''}`,
  },
  closed: {
    subject: 'Update Request Closed',
    bodyGen: (req, notes) => `Your ticket (${req.request_subject}) has been closed.${notes ? `\n\nSummary: ${notes}` : ''}`,
  },
};

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

    const payload: RespondUpdateRequestPayload = await req.json();

    if (!payload.request_id || typeof payload.request_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation failed: request_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const validStatuses = ['submitted', 'under_review', 'in_progress', 'completed', 'rejected', 'closed'];
    if (!payload.status || !validStatuses.includes(payload.status)) {
      return new Response(
        JSON.stringify({ error: `Validation failed: status must be one of ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (payload.resolution_notes && payload.resolution_notes.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: resolution_notes cannot exceed 2000 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch current update request
    const { data: updateReq, error: fetchError } = await supabaseClient
      .from('update_requests')
      .select('id, requested_by_email, request_subject, work_order_id, blanket_po_id, status')
      .eq('id', payload.request_id)
      .single();

    if (fetchError || !updateReq) {
      return new Response(
        JSON.stringify({ error: `Update request not found: ${fetchError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Prepare update fields
    const updates: Record<string, any> = {
      status: payload.status,
      resolution_notes: payload.resolution_notes || null,
      updated_at: new Date().toISOString(),
    };

    if (payload.status === 'completed' || payload.status === 'rejected' || payload.status === 'closed') {
      updates.resolved_at = new Date().toISOString();
    }
    if (payload.new_cut_sheet_id) {
      updates.new_cut_sheet_id = payload.new_cut_sheet_id;
    }

    // 3. If completed with revised cut sheet, link to active work order
    if (payload.status === 'completed' && payload.new_cut_sheet_id && updateReq.work_order_id) {
      // Mark prior versions as not current
      await supabaseClient
        .from('apply_cut_sheets')
        .update({ is_current: false })
        .eq('work_order_id', updateReq.work_order_id);

      // Set new cut sheet as current
      await supabaseClient
        .from('apply_cut_sheets')
        .update({
          is_current: true,
          work_order_id: updateReq.work_order_id,
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', payload.new_cut_sheet_id);
    }

    // 4. Update request row
    const { data: updatedRecord, error: updateError } = await supabaseClient
      .from('update_requests')
      .update(updates)
      .eq('id', payload.request_id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update request: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Send status transition email notification
    const template = EMAIL_TEMPLATES[payload.status] || EMAIL_TEMPLATES.under_review;
    await supabaseClient.from('notification_logs').insert({
      recipient_email: updateReq.requested_by_email,
      notification_type: `update_request_${payload.status}`,
      subject: `[${template.subject}] Order Revision Ticket #${updateReq.id.slice(0, 8)}`,
      body: template.bodyGen(updateReq, payload.resolution_notes),
      related_update_request_id: payload.request_id,
      sent_at: new Date().toISOString(),
      delivered: true,
      opened: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        request: updatedRecord,
        message: `Update request status successfully changed to ${payload.status}.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error responding to update request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
