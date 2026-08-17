// ============================================================================
// FORGE & FABRIC — EDGE FUNCTION: INVITE USER
// supabase/functions/invite-user/index.ts
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequestBody {
  email: string;
  full_name: string;
  role: string;
  facility_scope?: string;
  company_id?: string;
  company_name?: string; // freeform brand name for new companies
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server missing Supabase service configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client bypassing RLS for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body: InviteRequestBody = await req.json();
    const { email, full_name, role, facility_scope, company_id, company_name } = body;

    // 1. Basic Field Validation
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email address is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!full_name || !full_name.trim()) {
      return new Response(
        JSON.stringify({ error: "Full name is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. HARD SERVER-SIDE VALIDATION: Customer role MUST have a valid company_id OR a company_name
    if (role === "customer") {
      if ((!company_id || company_id.trim() === "") && (!company_name || company_name.trim() === "")) {
        return new Response(
          JSON.stringify({
            error: "Company selection or brand name is strictly required for customer role invites.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify company_id exists if provided
      if (company_id && company_id.trim() !== "") {
        const { data: company, error: companyErr } = await supabaseAdmin
          .from("companies")
          .select("id, name")
          .eq("id", company_id)
          .single();

        if (companyErr || !company) {
          return new Response(
            JSON.stringify({
              error: "The specified company ID was not found in the CRM master.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fetch company name if present for custom email data, or use provided freeform name
    let resolvedCompanyName: string | undefined = company_name?.trim() || undefined;
    if (company_id && company_id.trim() !== "") {
      const { data: comp } = await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", company_id)
        .single();
      if (comp) resolvedCompanyName = comp.name;
    }

    // 3. Dispatch Supabase Admin Invite
    const redirectToUrl = `${Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173"}/login`;
    const { data: authUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        redirectTo: redirectToUrl,
        data: {
          full_name: full_name.trim(),
          role: role,
          company_id: company_id ?? null,
          facility_scope: facility_scope ?? "Sewing Facility",
          company_name: resolvedCompanyName ?? null,
        },
      }
    );

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authUser.user.id;

    // 4. Create/Upsert Profile Record with status='invited'
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role: role,
      company_id: company_id ?? null,
      customer_name: resolvedCompanyName ?? null,
      facility_scope: facility_scope ?? "Sewing Facility",
      status: "invited",
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error("Failed to insert profile row for invited user:", profileError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation successfully sent to ${email.trim()}`,
        user_id: userId,
        company_name: resolvedCompanyName,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error during user invite." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  }

});
