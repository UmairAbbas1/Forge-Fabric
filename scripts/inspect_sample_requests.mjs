import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectSampleRequests() {
  const { data: sr, error: srErr } = await supabase.from("sample_requests").select("*");
  console.log("sample_requests table:", srErr ? srErr.message : sr);

  const { data: subs, error: subErr } = await supabase.from("apply_submissions").select("*").eq("submission_type", "sample_request");
  console.log("apply_submissions sample requests:", subErr ? subErr.message : subs);
}

inspectSampleRequests();
