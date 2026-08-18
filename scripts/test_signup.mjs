import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUserCreation() {
  console.log("Testing user signup for Weissmade...");
  const { data, error } = await supabase.auth.signUp({
    email: "weissmade@forgefabric.com",
    password: "Password123!",
    options: {
      data: {
        full_name: "Weissmade Representative",
        customer_name: "Weissmade",
        role: "customer"
      }
    }
  });

  if (error) {
    console.error("Signup error:", error.message);
  } else {
    console.log("Signup success! User ID:", data.user?.id);
  }
}

testUserCreation();
