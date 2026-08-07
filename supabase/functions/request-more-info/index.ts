import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestInfoPayload {
  submission_id: string;
  questions: string[];
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

    const payload: RequestInfoPayload = await req.json();

    // Validation schema check
    if (!payload.submission_id || typeof payload.submission_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Validation failed: submission_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: questions must contain at least 1 question.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (payload.questions.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: questions cannot exceed 10 items.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch submission details
    const { data: submission, error: subError } = await supabaseClient
      .from('apply_submissions')
      .select('id, company_name, contact_name, contact_email, apply_reference_code')
      .eq('id', payload.submission_id)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: `Submission not found: ${subError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const questionsFormatted = payload.questions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');
    const updatedNotes = payload.notes
      ? `[Requested More Info: ${new Date().toLocaleDateString()}]\n${questionsFormatted}\nNote: ${payload.notes}`
      : `[Requested More Info: ${new Date().toLocaleDateString()}]\n${questionsFormatted}`;

    // 2. Update status to 'needs_info'
    const { error: updateError } = await supabaseClient
      .from('apply_submissions')
      .update({
        status: 'needs_info',
        internal_notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.submission_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update submission status: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Log notification and email trigger
    await supabaseClient.from('notification_logs').insert({
      recipient_email: submission.contact_email,
      notification_type: 'needs_clarification',
      subject: `Action Required: More information needed for order ${submission.apply_reference_code}`,
      body: `Dear ${submission.contact_name},\n\nOur merchandising team requires additional clarification regarding your order application:\n\n${questionsFormatted}\n\nPlease reply or update your submission through the client portal.`,
      related_submission_id: payload.submission_id,
      sent_at: new Date().toISOString(),
      delivered: true,
      opened: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: payload.submission_id,
        status: 'needs_info',
        message: 'Information request logged and email alert dispatched to client.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing info request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
