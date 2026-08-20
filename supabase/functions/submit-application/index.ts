import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface SubmitApplicationPayload {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  brand_name?: string;
  website?: string;
  submission_type?: 'new_order' | 'update_request' | 'sample_request';
  source?: 'apply_portal' | 'merchandiser_intake' | 'email';
  client_notes?: string;
  product_type?: string;
  fabric_type?: string;
  style_blocks?: Record<string, any>[];
  trim_components?: Record<string, any>[];
  // REQ-14: internal stage numbers this submission requested (union across style blocks).
  requested_stages?: number[];
  cut_sheets?: Array<{
    sheet_type: string;
    cut_for?: string;
    ship_to?: string;
    style_no: string;
    style_description?: string;
    cut_no?: string;
    cut_date?: string;
    data_clerk?: string;
    cutter_name?: string;
    spreader_name?: string;
    sewer_name?: string;
    wash_dx_cd?: string;
    laundry_self?: 'Laundry' | 'Self';
    sheet_data: Record<string, any>;
    original_excel_url?: string;
  }>;
  documents?: Array<{
    doc_type: string;
    file_name: string;
    file_path: string;
    file_size_bytes?: number;
    mime_type?: string;
    description?: string;
  }>;
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

    const payload: SubmitApplicationPayload = await req.json();

    // 1. Validation
    if (!payload.company_name || !payload.contact_name || !payload.contact_email) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed: company_name, contact_name, and contact_email are required.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Insert apply_submissions record
    const { data: submission, error: subError } = await supabaseClient
      .from('apply_submissions')
      .insert({
        company_name: payload.company_name,
        contact_name: payload.contact_name,
        contact_email: payload.contact_email.trim().toLowerCase(),
        contact_phone: payload.contact_phone,
        brand_name: payload.brand_name,
        website: payload.website,
        submission_type: payload.submission_type || 'new_order',
        source: payload.source || 'apply_portal',
        client_notes: payload.client_notes,
        status: 'pending_review',
        product_type: payload.product_type,
        fabric_type: payload.fabric_type,
        style_blocks: payload.style_blocks || [],
        trim_components: payload.trim_components || [],
        requested_stages: payload.requested_stages,
      })
      .select()
      .single();

    if (subError || !submission) {
      console.error('Error inserting apply_submission:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to create application submission', details: subError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const submissionId = submission.id;
    const referenceCode = submission.apply_reference_code;

    // 3. Insert cut sheets if provided
    if (payload.cut_sheets && payload.cut_sheets.length > 0) {
      const cutSheetInserts = payload.cut_sheets.map((cs) => ({
        submission_id: submissionId,
        sheet_type: cs.sheet_type || 'factory_one_production',
        cut_for: cs.cut_for,
        ship_to: cs.ship_to,
        style_no: cs.style_no,
        style_description: cs.style_description,
        cut_no: cs.cut_no,
        cut_date: cs.cut_date,
        data_clerk: cs.data_clerk,
        cutter_name: cs.cutter_name,
        spreader_name: cs.spreader_name,
        sewer_name: cs.sewer_name,
        wash_dx_cd: cs.wash_dx_cd,
        laundry_self: cs.laundry_self,
        sheet_data: cs.sheet_data || {},
        original_excel_url: cs.original_excel_url,
      }));

      const { error: csError } = await supabaseClient
        .from('apply_cut_sheets')
        .insert(cutSheetInserts);

      if (csError) {
        console.error('Error inserting apply_cut_sheets:', csError);
      }
    }

    // 4. Insert documents if provided
    if (payload.documents && payload.documents.length > 0) {
      const docInserts = payload.documents.map((doc) => ({
        submission_id: submissionId,
        doc_type: doc.doc_type,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_size_bytes: doc.file_size_bytes,
        mime_type: doc.mime_type,
        description: doc.description,
      }));

      const { error: docError } = await supabaseClient
        .from('apply_documents')
        .insert(docInserts);

      if (docError) {
        console.error('Error inserting apply_documents:', docError);
      }
    }

    // 5. Create notification log
    await supabaseClient.from('notification_logs').insert({
      recipient_email: payload.contact_email,
      notification_type: 'submission_received',
      subject: `Order Application Received [${referenceCode || 'APP'}] - ${payload.company_name}`,
      body: `Thank you for your submission. Your reference code is ${referenceCode}. Our merchandising team will review your order details promptly.`,
      related_submission_id: submissionId,
      delivered: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: submissionId,
        reference_code: referenceCode,
        status: submission.status,
        message: 'Application submitted successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled submit-application error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
