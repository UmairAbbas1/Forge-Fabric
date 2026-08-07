import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface SubmitUpdateRequestPayload {
  blanket_po_id?: string;
  work_order_id?: string;
  requested_by_customer_id?: string;
  requested_by_email: string;
  request_type: string;
  request_subject: string;
  request_description: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  attachment_urls?: string[];
  new_cut_sheet?: {
    sheet_type: string;
    style_no: string;
    sheet_data: Record<string, any>;
    original_excel_url?: string;
  };
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

    const payload: SubmitUpdateRequestPayload = await req.json();

    if (!payload.requested_by_email || !payload.request_type || !payload.request_subject || !payload.request_description) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed: requested_by_email, request_type, request_subject, and request_description are required.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.blanket_po_id && !payload.work_order_id) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed: either blanket_po_id or work_order_id must be provided.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newCutSheetId: string | undefined;

    // If a new cut sheet is uploaded as part of the amendment
    if (payload.new_cut_sheet) {
      const { data: cutSheet, error: csErr } = await supabaseClient
        .from('apply_cut_sheets')
        .insert({
          sheet_type: payload.new_cut_sheet.sheet_type || 'custom',
          style_no: payload.new_cut_sheet.style_no,
          sheet_data: payload.new_cut_sheet.sheet_data || {},
          original_excel_url: payload.new_cut_sheet.original_excel_url,
          is_current: false, // will become current once update request is approved
        })
        .select()
        .single();

      if (!csErr && cutSheet) {
        newCutSheetId = cutSheet.id;
      }
    }

    const { data: updateReq, error: reqError } = await supabaseClient
      .from('update_requests')
      .insert({
        blanket_po_id: payload.blanket_po_id,
        work_order_id: payload.work_order_id,
        requested_by_customer_id: payload.requested_by_customer_id,
        requested_by_email: payload.requested_by_email.trim().toLowerCase(),
        request_type: payload.request_type,
        request_subject: payload.request_subject,
        request_description: payload.request_description,
        priority: payload.priority || 'normal',
        status: 'submitted',
        attachment_urls: payload.attachment_urls || [],
        new_cut_sheet_id: newCutSheetId,
      })
      .select()
      .single();

    if (reqError || !updateReq) {
      console.error('Error inserting update_request:', reqError);
      return new Response(
        JSON.stringify({ error: 'Failed to create update request', details: reqError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log notification
    await supabaseClient.from('notification_logs').insert({
      recipient_email: payload.requested_by_email,
      notification_type: 'update_request',
      subject: `Update Request Logged: ${payload.request_subject}`,
      body: `Your change request for order has been submitted. Priority: ${payload.priority || 'normal'}. Our team is reviewing the requested modifications.`,
      related_update_request_id: updateReq.id,
      delivered: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: updateReq.id,
        status: updateReq.status,
        message: 'Update request submitted successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled submit-update-request error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
