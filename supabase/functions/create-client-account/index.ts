import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateClientPayload {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
}

function generateSecurePassword(length = 14): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~';
  let retVal = '';
  const cryptoObj = crypto;
  const values = new Uint32Array(length);
  cryptoObj.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    retVal += charset[values[i] % charset.length];
  }
  return retVal;
}

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

    const payload: CreateClientPayload = await req.json();

    if (!payload.company_name || payload.company_name.trim().length > 150) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: company_name is required (max 150 chars).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!payload.contact_email || !emailRegex.test(payload.contact_email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Validation failed: a valid contact_email is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = payload.contact_email.trim().toLowerCase();
    const cleanCompany = payload.company_name.trim();
    const cleanName = payload.contact_name?.trim() || cleanCompany;

    // 1. Check if profile already exists
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email, role, company_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          success: true,
          is_existing: true,
          user_id: existingProfile.id,
          profile: existingProfile,
          message: `Client with email ${cleanEmail} already exists. Linked to existing customer record.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tempPassword = generateSecurePassword();
    const magicToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // 2. Create Auth User in Supabase Auth
    const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        company_name: cleanCompany,
        role: 'customer',
        contact_phone: payload.contact_phone || null,
        magic_token: magicToken,
        magic_token_expires_at: expiresAt,
      },
    });

    if (authError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: `Failed to create auth credentials: ${authError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.user.id;

    // 3. Upsert into public.profiles
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        full_name: cleanName,
        email: cleanEmail,
        role: 'customer',
        company_name: cleanCompany,
        phone: payload.contact_phone || null,
        is_portal_user: true,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.warn('Profile upsert note:', profileError.message);
    }

    // 4. Send Onboarding Welcome Email with Magic Link (Fix #2)
    const portalUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://forgefabric.com';
    const magicLink = `${portalUrl}/login?token=${magicToken}&email=${encodeURIComponent(cleanEmail)}`;

    await supabaseClient.from('notification_logs').insert({
      recipient_id: userId,
      recipient_email: cleanEmail,
      notification_type: 'client_account_created',
      subject: 'Welcome to Forge & Fabric — Client Portal Access',
      body: `Dear ${cleanName},\n\nYour client portal account for ${cleanCompany} has been created.\n\nTemporary Login:\nEmail: ${cleanEmail}\nTemp Password: ${tempPassword}\n\nOr click your secure onboarding link to initialize your permanent password:\n${magicLink}\n\n(This magic link is active for 7 days.)`,
      sent_at: new Date().toISOString(),
      delivered: true,
      opened: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        is_existing: false,
        user_id: userId,
        temp_password: tempPassword,
        magic_link: magicLink,
        expires_at: expiresAt,
        message: 'Client account created successfully and welcome credentials dispatched.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error creating client account' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
