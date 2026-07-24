import { createClient } from "@supabase/supabase-js";

const url = "https://myednlgltvpszzcjfrta.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(url, key);

async function testAuthSignUp() {
  const testEmail = `test_${Date.now()}@forgefabric.com`;
  console.log("Attempting live Supabase signUp for:", testEmail);

  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: "RealPassword123!",
    options: {
      data: {
        role: "admin",
        full_name: "Test Live Supabase User"
      }
    }
  });

  console.log("SignUp response:", {
    user: data?.user?.id,
    session: data?.session ? "Active Session" : "No Session (Email Confirmation Required or Disabled)",
    error: error?.message || null
  });

  if (data?.user) {
    const { data: profData, error: profErr } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email: testEmail,
      role: "admin",
      full_name: "Test Live Supabase User"
    });
    console.log("Profiles upsert result:", { profData, error: profErr?.message || null });
  }
}

testAuthSignUp();
