// ============================================================================
// FORGE & FABRIC — EDGE FUNCTION: INVITE USER
// supabase/functions/invite-user/index.ts
//
// Creates the auth user + a real, secure Supabase invite link (via
// generateLink, NOT inviteUserByEmail — that call also tries to dispatch
// Supabase's own built-in email, which is exactly the throttled/unreliable
// path this function exists to avoid), then delivers that link itself via
// the Brevo (Sendinblue) HTTP API. Brevo requires only a single verified
// SENDER EMAIL (no domain/DNS setup) and delivers to any recipient on its
// free plan — set BREVO_API_KEY + BREVO_FROM_EMAIL. Swapping to a verified
// domain sender later is just an env var change, no code change needed.
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

function roleTitle(role: string): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "Executive Administrator";
    case "merchandiser":
      return "Lead Merchandiser & Account Manager";
    case "production":
    case "production_manager":
      return "Production & Floor Manager";
    case "qc":
    case "qc_inspector":
      return "Quality Control Inspector";
    case "warehouse":
      return "Warehouse & Logistics Supervisor";
    case "customer":
      return "Brand Portal Customer";
    default:
      return role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

function inviteEmailHtml(fullName: string, role: string, companyName: string | undefined, actionLink: string): string {
  const company = companyName ? ` at ${companyName}` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; margin: 0; padding: 0; }
  .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; padding: 40px; }
  .wordmark { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: #71717a; text-transform: uppercase; margin: 0 0 28px 0; }
  h1 { font-size: 20px; font-weight: 700; color: #18181b; margin: 0 0 12px 0; }
  p { font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 24px 0; }
  .btn { display: inline-block; background: #18181b; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; }
  .note { font-size: 12px; line-height: 1.5; color: #a1a1aa; margin: 28px 0 0 0; }
  .footer { font-size: 12px; color: #a1a1aa; text-align: center; margin-top: 20px; }
</style></head>
<body>
  <div class="container">
    <p class="wordmark">Forge &amp; Fabric</p>
    <h1>Hi ${fullName},</h1>
    <p>You've been invited to join as <strong>${roleTitle(role)}</strong>${company}. Set a password to activate your account.</p>
    <a href="${actionLink}" class="btn" target="_blank">Set your password</a>
    <p class="note">This link is single-use and expires soon. If you weren't expecting this, you can ignore it.</p>
  </div>
  <p class="footer">&copy; 2026 Forge &amp; Fabric Industries, Inc.</p>
</body></html>`;
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

    // Caller authentication/authorization: this function provisions accounts
    // (including admin accounts) via the service role key, so it must never
    // trust the request body alone. Verify the caller's own JWT resolves to
    // a real, active internal-staff profile before doing anything else —
    // mirrors the role list public.is_internal_staff() uses in RLS.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!callerToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: missing authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: callerAuth, error: callerAuthErr } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerAuthErr || !callerAuth?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or expired session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const INTERNAL_STAFF_ROLES = [
      "super_admin", "admin", "merchandiser", "production_manager",
      "cutting_supervisor", "sewing_supervisor", "qc_inspector",
      "warehouse", "finance", "production", "qc",
    ];
    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, deactivated")
      .eq("id", callerAuth.user.id)
      .maybeSingle();

    if (
      callerProfileErr ||
      !callerProfile ||
      callerProfile.deactivated ||
      !INTERNAL_STAFF_ROLES.includes(callerProfile.role)
    ) {
      return new Response(
        JSON.stringify({ error: "Forbidden: only internal staff may invite users." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // 3. Create the user + a real, secure invite link — generateLink (not
    // inviteUserByEmail) so Supabase never attempts its own email dispatch;
    // this function sends the one real email itself, below.
    const redirectToUrl = `${Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173"}/login`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: email.trim(),
      options: {
        redirectTo: redirectToUrl,
        data: {
          full_name: full_name.trim(),
          role: role,
          company_id: company_id ?? null,
          facility_scope: facility_scope ?? "Sewing Facility",
          company_name: resolvedCompanyName ?? null,
        },
      },
    });

    if (linkError) {
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = linkData.user.id;
    const actionLink = linkData.properties?.action_link;

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

    // 5. Dispatch the actual invite email via Brevo. BREVO_FROM_EMAIL must be
    // a sender address verified in the Brevo dashboard (Settings → Senders) —
    // no domain/DNS required, and once verified Brevo delivers to any
    // recipient on the free plan (300/day).
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    let emailDelivered = false;
    let emailError: string | undefined;

    if (brevoApiKey && actionLink) {
      try {
        const fromEmail = Deno.env.get("BREVO_FROM_EMAIL");
        if (!fromEmail) {
          emailError = "BREVO_FROM_EMAIL is not configured — invite link generated but no email was sent.";
        } else {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoApiKey,
              "Content-Type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Forge & Fabric", email: fromEmail },
              to: [{ email: email.trim(), name: full_name.trim() }],
              subject: "Welcome to Forge & Fabric Industries, Inc. — Portal Access",
              htmlContent: inviteEmailHtml(full_name.trim(), role, resolvedCompanyName, actionLink),
            }),
          });
          if (res.ok) {
            emailDelivered = true;
          } else {
            emailError = await res.text().catch(() => "Brevo API returned an error");
          }
        }
      } catch (err: any) {
        emailError = err.message;
        console.warn("Brevo dispatch failed:", err);
      }
    } else if (!brevoApiKey) {
      emailError = "BREVO_API_KEY is not configured — invite link generated but no email was sent.";
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: emailDelivered
          ? `Invitation email sent to ${email.trim()}`
          : `Account created — invite link ready, but email delivery failed or is not configured yet.`,
        user_id: userId,
        company_name: resolvedCompanyName,
        email_delivered: emailDelivered,
        email_error: emailError,
        action_link: actionLink,
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
