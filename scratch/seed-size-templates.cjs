const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://myednlgltvpszzcjfrta.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(supabaseUrl, supabaseKey);

const PRESET_TEMPLATES = [
  {
    template_name: 'Numeric Waist (Bottoms 28-40)',
    category: 'Denim/Bottoms',
    size_columns: ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'],
    is_preset: true,
  },
  {
    template_name: 'Alpha Standard (XS - XXL)',
    category: 'Hoodie/Sweatshirt',
    size_columns: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    is_preset: true,
  },
  {
    template_name: 'Extended Alpha (XS - 3XL)',
    category: 'T-Shirt',
    size_columns: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
    is_preset: true,
  },
  {
    template_name: 'Kids Age-Based (2Y - 14Y)',
    category: 'Kidswear',
    size_columns: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y', '14Y'],
    is_preset: true,
  },
  {
    template_name: 'One Size Fits All (OSFA)',
    category: 'Custom/Other',
    size_columns: ['OSFA'],
    is_preset: true,
  },
];

async function seed() {
  console.log('Seeding standard size templates into size_templates table...');
  const { data: existing } = await supabase.from('size_templates').select('template_name');
  const existingNames = new Set((existing || []).map(e => e.template_name));
  
  const toInsert = PRESET_TEMPLATES.filter(t => !existingNames.has(t.template_name));

  if (toInsert.length > 0) {
    const { data, error } = await supabase.from('size_templates').insert(toInsert);
    if (error) {
      console.error('Seeding error:', error);
    } else {
      console.log(`Successfully seeded ${toInsert.length} standard size templates!`);
    }
  } else {
    console.log('Standard preset size templates already present in database.');
  }
}

seed();
