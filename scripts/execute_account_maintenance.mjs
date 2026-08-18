import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Accounts to strictly remove
const JUNK_EMAILS = [
  "billa@gmail.com",
  "billa123@gmail.com",
  "billa2@gmail.com",
  "testing123@gmail.com",
  "meow@gmail.com",
  "happycat@gmail.com",
  "panda@gmail.com",
  "test_1784892553022@forgefabric.com",
  "faizijaz917@gmail.com",
  "faizijaz918@gmail.com",
  "faizijaz919@gmail.com",
  "faizijaz920@gmail.com",
  "faizijaz921@gmail.com",
  "testing@gmail.com",
  "testing21@gmail.com",
  "uamirtesting@gmail.com",
  "umairtesting@gmail.com"
];

const JUNK_CUSTOMER_NAMES = [
  "billaai", "billacompany", "billaai", "billahouse", "meowsolutions", "happyai", "panda",
  "mycompany", "bigcompany", "smallcompany", "midcompany", "low company", "testingcompany", "testingco",
  "umairtest", "umairtest1"
];

async function runMaintenance() {
  console.log("=== STARTING BACKEND ACCOUNT & DATA CLEANUP ===");

  // 1. Clean dummy orders and submissions
  console.log("1. Cleaning dummy orders and submissions...");
  for (const cust of JUNK_CUSTOMER_NAMES) {
    await supabase.from("orders").delete().ilike("customer_name", `%${cust}%`);
    await supabase.from("apply_submissions").delete().ilike("company_name", `%${cust}%`);
    await supabase.from("packing_lists").delete().ilike("customer_name", `%${cust}%`);
  }

  // 2. Clean dummy profiles
  console.log("2. Deleting dummy profile records...");
  for (const email of JUNK_EMAILS) {
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (prof) {
      await supabase.from("profiles").delete().eq("id", prof.id);
      console.log(`Deleted profile for: ${email}`);
    }
  }

  // 3. Ensure Weissmade account is created & configured
  console.log("3. Registering & Configuring Weissmade...");
  let weissId;
  const { data: weissSign, error: weissErr } = await supabase.auth.signUp({
    email: "weissmade@forgefabric.com",
    password: "Password123!",
    options: {
      data: {
        full_name: "Weissmade Brand Rep",
        customer_name: "Weissmade",
        role: "customer"
      }
    }
  });

  if (weissSign?.user) weissId = weissSign.user.id;
  if (weissErr) {
    console.log("Weissmade signup note:", weissErr.message);
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", "weissmade@forgefabric.com").maybeSingle();
    if (existing) weissId = existing.id;
  }

  if (weissId) {
    await supabase.from("profiles").upsert({
      id: weissId,
      email: "weissmade@forgefabric.com",
      full_name: "Weissmade Brand Rep",
      customer_name: "Weissmade",
      role: "customer",
      is_portal_user: true,
      portal_access_enabled: true,
      status: "active",
      facility_scope: "All",
      deactivated: false
    });
    console.log("Weissmade profile confirmed!");
  }

  // 4. Ensure Fear of God account is created & configured
  console.log("4. Registering & Configuring Fear of God...");
  let fogId;
  const { data: fogSign, error: fogErr } = await supabase.auth.signUp({
    email: "fearofgod@forgefabric.com",
    password: "Password123!",
    options: {
      data: {
        full_name: "Fear of God Brand Rep",
        customer_name: "Fear of God",
        role: "customer"
      }
    }
  });

  if (fogSign?.user) fogId = fogSign.user.id;
  if (fogErr) {
    console.log("Fear of God signup note:", fogErr.message);
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", "fearofgod@forgefabric.com").maybeSingle();
    if (existing) fogId = existing.id;
  }

  if (fogId) {
    await supabase.from("profiles").upsert({
      id: fogId,
      email: "fearofgod@forgefabric.com",
      full_name: "Fear of God Brand Rep",
      customer_name: "Fear of God",
      role: "customer",
      is_portal_user: true,
      portal_access_enabled: true,
      status: "active",
      facility_scope: "All",
      deactivated: false
    });
    console.log("Fear of God profile confirmed!");
  }

  // 5. Update Ahmad234@gmail.com to ensure clean Servade link
  console.log("5. Verifying Servade (Ahmad234@gmail.com)...");
  const { data: ahmadProf } = await supabase.from("profiles").select("*").ilike("email", "ahmad234@gmail.com").maybeSingle();
  if (ahmadProf) {
    await supabase.from("profiles").update({
      customer_name: "Servade",
      role: "customer",
      portal_access_enabled: true,
      is_portal_user: true,
      status: "active"
    }).eq("id", ahmadProf.id);
    console.log("Ahmad234 (Servade) profile verified!");
  }

  // 6. Ensure Levi Strauss & Co. profile
  const { data: leviProf } = await supabase.from("profiles").select("*").ilike("email", "customer@forgefabric.com").maybeSingle();
  if (leviProf) {
    await supabase.from("profiles").update({
      customer_name: "Levi Strauss & Co.",
      role: "customer",
      portal_access_enabled: true,
      is_portal_user: true,
      status: "active"
    }).eq("id", leviProf.id);
    console.log("Levi Strauss & Co. profile verified!");
  }

  // 7. Summary of Final Profiles
  console.log("\n=== FINAL PRISTINE PROFILES IN BACKEND ===");
  const { data: finalProfiles } = await supabase.from("profiles").select("id, email, full_name, role, customer_name, status");
  finalProfiles?.forEach((p, i) => {
    console.log(`[${i+1}] ${p.email} | Role: ${p.role} | Customer: "${p.customer_name || 'N/A'}" | Status: ${p.status}`);
  });
}

runMaintenance();
