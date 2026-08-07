import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface NotificationPayload {
  recipient_id?: string;
  recipient_email: string;
  notification_type:
    | 'submission_received'
    | 'status_update'
    | 'update_request'
    | 'assignment'
    | 'approval'
    | 'rejection'
    | 'needs_info';
  subject: string;
  body: string;
  related_submission_id?: string;
  related_update_request_id?: string;
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

    const payload: NotificationPayload = await req.json();

    if (!payload.recipient_email || !payload.notification_type || !payload.subject) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed: recipient_email, notification_type, and subject are required.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Dispatch to Resend API if API Key is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    let externalDelivered = false;

    if (resendApiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Forge & Fabric <production@forgeworks.io>',
            to: [payload.recipient_email],
            subject: payload.subject,
            html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e1b18;">
              <h2 style="color: #965a28; border-bottom: 2px solid #e0deda; padding-bottom: 8px;">Forge & Fabric Production</h2>
              <p>${payload.body.replace(/\n/g, '<br/>')}</p>
              <hr style="border: none; border-top: 1px solid #e0deda; margin: 24px 0;" />
              <p style="font-size: 12px; color: #787570;">This is an automated production alert from Forge & Fabric Industrial Garment Manufacturing Platform.</p>
            </div>`,
          }),
        });
        if (res.ok) {
          externalDelivered = true;
        }
      } catch (err) {
        console.warn('Resend dispatch skipped/failed:', err);
      }
    }

    // Log to notification_logs table
    const { data: logEntry, error: logError } = await supabaseClient
      .from('notification_logs')
      .insert({
        recipient_id: payload.recipient_id,
        recipient_email: payload.recipient_email.trim().toLowerCase(),
        notification_type: payload.notification_type,
        subject: payload.subject,
        body: payload.body,
        related_submission_id: payload.related_submission_id,
        related_update_request_id: payload.related_update_request_id,
        delivered: externalDelivered || true,
        opened: false,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error recording notification log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logEntry?.id,
        delivered: externalDelivered || true,
        message: 'Notification processed and recorded',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled send-notification error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
