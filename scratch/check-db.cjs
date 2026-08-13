const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking size_templates table...");
  const { data: stData, error: stErr } = await supabase.from('size_templates').select('*').limit(1);
  console.log("size_templates error:", stErr);
  console.log("size_templates data:", stData);

  console.log("Checking apply_submissions columns...");
  const { data: appData, error: appErr } = await supabase.from('apply_submissions').select('product_type, fabric_type, style_blocks, trim_components').limit(1);
  console.log("apply_submissions error:", appErr);
  console.log("apply_submissions data:", appData);
}

check();
