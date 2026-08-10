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

    // Call atomic RPC stored procedure for transactional guarantee
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      'convert_submission_to_blanket_po',
      {
        p_submission_id: payload.submission_id,
        p_custom_po_number: payload.po_number || null,
        p_override_total_qty: payload.total_qty || null
      }
    );

    if (rpcError) {
      console.error('Error in convert_submission_to_blanket_po RPC:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Atomic conversion failed', details: rpcError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        subject: `Application Approved: Blanket PO Created [${rpcResult.po_number}]`,
        body: `Congratulations! Your order application (${subData.apply_reference_code}) for ${subData.company_name} has been approved and converted to Blanket PO #${rpcResult.po_number}. Production planning is now underway.`,
        related_submission_id: payload.submission_id,
        delivered: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        po_id: rpcResult.po_id,
        po_number: rpcResult.po_number,
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
