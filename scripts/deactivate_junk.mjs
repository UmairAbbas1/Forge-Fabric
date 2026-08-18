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

async function deactivateJunk() {
  for (const email of JUNK_EMAILS) {
    const { error } = await supabase.from("profiles").update({
      deactivated: true,
      status: "suspended",
      customer_name: "DEACTIVATED_TEST_ACCOUNT",
      full_name: "DEACTIVATED"
    }).eq("email", email);

    if (error) console.log(`Failed to update ${email}:`, error.message);
    else console.log(`Deactivated ${email}`);
  }
}

deactivateJunk();
