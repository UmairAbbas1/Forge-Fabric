import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface ConvertPayload {
  submission_id: string;
  po_number?: string;
  total_qty?: number;
  work_orders?: Array<{
    wo_number?: string;
    style_name: string;
    colorway?: string;
    wash_process_type?: string;
    target_qty?: number;
    size_breakdown?: Record<string, number>;
    cut_sheet_id?: string;
    due_date?: string;
    order_type?: 'Bulk' | 'Sample' | 'Rush';
    priority?: 'Normal' | 'Rush';
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: ConvertPayload = await req.json();
    if (!payload.submission_id) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: submission_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let poId = rpcResult?.po_id;
    let poNumber = rpcResult?.po_number;

    if (rpcError || !rpcResult) {
      console.warn('RPC convert_submission_to_blanket_po notice, executing direct service_role insertion:', rpcError);
      
      // Fallback direct service_role conversion
      const { data: subData } = await supabaseClient
        .from('apply_submissions')
        .select('*')
        .eq('id', payload.submission_id)
        .single();

      if (!subData) {
        return new Response(
          JSON.stringify({ error: `Submission ${payload.submission_id} not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure customer
      let custId = payload.customer_id;
      if (!custId && subData.company_name) {
        const { data: custData } = await supabaseClient
          .from('customers')
          .select('id')
          .ilike('name', subData.company_name)
          .limit(1);

        if (custData && custData.length > 0) {
          custId = custData[0].id;
        } else {
          const { data: newCust } = await supabaseClient
            .from('customers')
            .insert({ name: subData.company_name })
            .select('id')
            .single();
          custId = newCust?.id;
        }
      }

      poNumber = payload.po_number || `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: bpo, error: bpoErr } = await supabaseClient
        .from('blanket_pos')
        .insert({
          po_number: poNumber,
          customer_id: custId || null,
          customer_type: 'External',
          total_contract_qty: payload.total_qty || 100,
          fulfilled_qty: 0,
          po_type: 'Blanket',
          source_submission_id: payload.submission_id,
          apply_reference_code: subData.apply_reference_code,
          client_submitted: true,
          status: 'Open',
        })
        .select('id, po_number')
        .single();

      if (bpoErr) {
        console.error('Failed to create blanket PO in fallback:', bpoErr);
        return new Response(
          JSON.stringify({ error: 'Failed to create blanket PO', details: bpoErr }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      poId = bpo.id;
      poNumber = bpo.po_number;

      await supabaseClient
        .from('apply_cut_sheets')
        .update({ work_order_id: null, is_current: true })
        .eq('submission_id', payload.submission_id);

      await supabaseClient
        .from('apply_submissions')
        .update({
          status: 'converted',
          converted_to_po_id: poId,
          converted_at: new Date().toISOString(),
        })
        .eq('id', payload.submission_id);
    }

    // Phase 2 Logic: Removed manual grocery list generation.
    // This is now automatically handled by the trg_auto_grocery_list Database Trigger
    // which calls generate_material_requisitions upon Work Order insertion.

    // Create client notification
    const { data: subData } = await supabaseClient
      .from('apply_submissions')
      .select('contact_email, company_name, apply_reference_code')
      .eq('id', payload.submission_id)
      .single();

    if (subData) {
      await supabaseClient.from('notification_logs').insert({
        recipient_email: subData.contact_email,
        notification_type: 'approval',
        subject: `Application Approved: Blanket PO Created [${poNumber}]`,
        body: `Congratulations! Your order application (${subData.apply_reference_code}) for ${subData.company_name} has been approved and converted to Blanket PO #${poNumber}. Production planning is now underway.`,
        related_submission_id: payload.submission_id,
        delivered: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        po_id: poId,
        po_number: poNumber,
        message: 'Application successfully converted to Blanket PO. Awaiting Production Scheduling.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled convert-submission-to-po error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
