import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface AssignPayload {
  submission_id: string;
  merchandiser_id: string;
  notes?: string;
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

    const payload: AssignPayload = await req.json();

    // Validation schema check
    if (!payload.submission_id || typeof payload.submission_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation failed: submission_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!payload.merchandiser_id || typeof payload.merchandiser_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation failed: merchandiser_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Update submission
    const { data: submission, error: subError } = await supabaseClient
      .from('apply_submissions')
      .update({
        assigned_merchandiser_id: payload.merchandiser_id,
        status: 'under_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.submission_id)
      .select('id, company_name, apply_reference_code')
      .single();

    if (subError) {
      return new Response(
        JSON.stringify({ error: `Failed to assign submission: ${subError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Insert merchandiser assignment audit record
    await supabaseClient.from('merchandiser_assignments').insert({
      submission_id: payload.submission_id,
      merchandiser_id: payload.merchandiser_id,
      notes: payload.notes || 'Assigned via Merchandiser Inbox',
      is_active: true,
      assigned_at: new Date().toISOString(),
    });

    // 3. Log notification for the assigned merchandiser
    await supabaseClient.from('notification_logs').insert({
      recipient_id: payload.merchandiser_id,
      recipient_email: 'merchandiser@forgefabric.com',
      notification_type: 'submission_assigned',
      subject: `Order Application Assigned: ${submission.company_name} (${submission.apply_reference_code})`,
      body: `You have been assigned to review submission ${submission.apply_reference_code} for ${submission.company_name}.`,
      related_submission_id: payload.submission_id,
      sent_at: new Date().toISOString(),
      delivered: true,
      opened: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: payload.submission_id,
        merchandiser_id: payload.merchandiser_id,
        message: 'Submission successfully assigned to merchandiser.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error during assignment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
