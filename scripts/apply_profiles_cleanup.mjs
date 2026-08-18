import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function applyCleanup() {
  console.log("Applying cleanup...");

  // Sign up Fear of God if not exists
  console.log("Checking Fear of God auth...");
  const { data: fogAuth, error: fogErr } = await supabase.auth.signUp({
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

  const fogId = fogAuth?.user?.id;
  if (fogId) {
    await supabase.from("profiles").upsert({
      id: fogId,
      email: "fearofgod@forgefabric.com",
      full_name: "Fear of God Brand Rep",
      customer_name: "Fear of God",
      role: "customer",
      status: "active",
      portal_access_enabled: true,
      is_portal_user: true
    });
  }

  // Sign up Weissmade if not exists
  console.log("Checking Weissmade auth...");
  const { data: weissAuth } = await supabase.auth.signUp({
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

  const weissId = weissAuth?.user?.id || "9b59d56b-04d0-44da-a729-9e84f40a3473";
  await supabase.from("profiles").upsert({
    id: weissId,
    email: "weissmade@forgefabric.com",
    full_name: "Weissmade Brand Rep",
    customer_name: "Weissmade",
    role: "customer",
    status: "active",
    portal_access_enabled: true,
    is_portal_user: true
  });

  // Verify Ahmad234@gmail.com
  console.log("Verifying Servade...");
  await supabase.from("profiles").update({
    customer_name: "Servade",
    role: "customer",
    status: "active",
    portal_access_enabled: true,
    is_portal_user: true
  }).ilike("email", "ahmad234@gmail.com");

  // Output all active verified profiles
  const { data: profs } = await supabase.from("profiles").select("*");
  const filtered = profs?.filter(p => !JUNK_EMAILS.includes(p.email.toLowerCase()));

  console.log(`\n=== PRISTINE PRODUCTION ACCOUNTS (${filtered?.length}) ===`);
  filtered?.forEach((p, i) => {
    console.log(`[${i+1}] ${p.email.padEnd(30)} | Role: ${p.role.padEnd(12)} | Brand: ${p.customer_name || 'N/A'}`);
  });
}

applyCleanup();
