const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  console.log("Querying rush_multiplier_tiers as anon...");
  const { data: anonData, error: anonErr } = await supabase.from('rush_multiplier_tiers').select('*');
  console.log("Anon Result:", { data: anonData, error: anonErr });

  console.log("Signing in as admin@forgefabric.com...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@forgefabric.com',
    password: 'password123'
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  const { data: adminData, error: adminErr } = await supabase.from('rush_multiplier_tiers').select('*');
  console.log("Admin Result:", { data: adminData, error: adminErr });
})();
