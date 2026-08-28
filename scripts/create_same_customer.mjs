import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BRAND_NAME = "SAME";
const EMAIL = "same@forgefabric.net";
const PASSWORD = "Same@Forge2026!";

async function createSameCustomer() {
  console.log(`\n========================================`);
  console.log(`Creating Backend Customer for: ${BRAND_NAME}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`========================================\n`);

  // 1. Insert or get Company Master record
  console.log("1. Ensuring Company Master record...");
  let { data: existingCompany } = await supabase
    .from("companies")
    .select("*")
    .ilike("name", BRAND_NAME)
    .maybeSingle();

  let companyId = existingCompany?.id;
  if (!companyId) {
    const newCompany = {
      id: crypto.randomUUID(),
      name: BRAND_NAME,
      code: `${BRAND_NAME}-CUST`,
      company_type: "Customer",
      status: "Active",
    };
    const { data: compData, error: compErr } = await supabase
      .from("companies")
      .insert(newCompany)
      .select()
      .single();

    if (compErr) {
      console.error("Error creating company:", compErr);
      return;
    }
    companyId = compData.id;
    console.log(`✅ Company created with ID: ${companyId}`);
  } else {
    console.log(`ℹ️ Existing company found with ID: ${companyId}`);
  }

  // 2. Insert or get Customers table record
  console.log("\n2. Ensuring Customers table record...");
  let { data: existingCust } = await supabase
    .from("customers")
    .select("*")
    .ilike("name", BRAND_NAME)
    .maybeSingle();

  if (!existingCust) {
    const newCustomer = {
      id: crypto.randomUUID(),
      name: BRAND_NAME,
      contact: EMAIL,
    };
    const { error: custErr } = await supabase
      .from("customers")
      .insert(newCustomer);

    if (custErr) {
      console.warn("Notice inserting into customers table:", custErr.message);
    } else {
      console.log(`✅ Customer master record created in 'customers' table.`);
    }
  } else {
    console.log(`ℹ️ Existing customer record found in 'customers' table.`);
  }

  // 3. Insert or get Contact record
  console.log("\n3. Ensuring Contact Master record...");
  let { data: existingContact } = await supabase
    .from("contacts")
    .select("*")
    .eq("email", EMAIL)
    .maybeSingle();

  if (!existingContact) {
    const newContact = {
      id: crypto.randomUUID(),
      company_id: companyId,
      first_name: BRAND_NAME,
      last_name: "Brand Representative",
      email: EMAIL,
      is_primary_contact: true,
    };
    const { error: contErr } = await supabase
      .from("contacts")
      .insert(newContact);

    if (contErr) {
      console.warn("Notice inserting into contacts table:", contErr.message);
    } else {
      console.log(`✅ Primary contact record created in 'contacts' table.`);
    }
  } else {
    console.log(`ℹ️ Existing contact record found in 'contacts' table.`);
  }

  // 4. Register Supabase Auth Account
  console.log("\n4. Registering Supabase Auth User...");
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: {
      data: {
        full_name: `${BRAND_NAME} Brand Representative`,
        customer_name: BRAND_NAME,
        company_name: BRAND_NAME,
        role: "customer",
      },
    },
  });

  let userId = authData?.user?.id;

  if (authErr) {
    console.warn("Auth signup notice:", authErr.message);
    // Try sign in to retrieve existing user ID
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    if (signInErr) {
      console.error("Sign in failed:", signInErr.message);
    } else {
      userId = signInData?.user?.id;
      console.log(`ℹ️ User already registered in Auth with ID: ${userId}`);
    }
  } else {
    console.log(`✅ Auth user registered successfully with ID: ${userId}`);
  }

  // 5. Upsert Profile record in profiles table
  if (userId) {
    console.log("\n5. Upserting user profile...");
    const profilePayload = {
      id: userId,
      email: EMAIL,
      role: "customer",
      customer_name: BRAND_NAME,
      company_name: BRAND_NAME,
      company_id: companyId,
      full_name: `${BRAND_NAME} Brand Representative`,
      is_portal_user: true,
      portal_access_enabled: true,
      status: "active",
      facility: "Sewing",
      facility_scope: "Sewing Facility",
      deactivated: false,
    };

    const { data: profData, error: profErr } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select()
      .single();

    if (profErr) {
      console.error("Error upserting profile:", profErr.message);
    } else {
      console.log("✅ Profile successfully upserted:", profData);
    }
  }

  // 6. Test Authentication & Session Verification
  console.log("\n6. Verifying login credentials...");
  const { data: testAuth, error: testErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (testErr) {
    console.error("❌ Test login verification failed:", testErr.message);
  } else {
    console.log("🎉 Test login successful!");
    console.log(`Logged in as: ${testAuth.user?.email} (${testAuth.user?.id})`);
    
    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("*, companies(name)")
      .eq("id", testAuth.user?.id)
      .single();
    
    console.log("Verified Profile in Database:", profileCheck);
  }
}

createSameCustomer();
