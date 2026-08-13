-- Migration 20260813000000_size_templates_seed_policy.sql
-- Seed standard preset size templates and ensure RLS policy for insert/read

-- 1. Insert preset size templates
INSERT INTO public.size_templates (template_name, category, size_columns, is_preset)
VALUES 
  ('Numeric Waist (Bottoms 28-40)', 'Denim/Bottoms', '["28", "29", "30", "31", "32", "33", "34", "36", "38", "40"]'::jsonb, true),
  ('Alpha Standard (XS - XXL)', 'Hoodie/Sweatshirt', '["XS", "S", "M", "L", "XL", "XXL"]'::jsonb, true),
  ('Extended Alpha (XS - 3XL)', 'T-Shirt', '["XS", "S", "M", "L", "XL", "XXL", "3XL"]'::jsonb, true),
  ('Kids Age-Based (2Y - 14Y)', 'Kidswear', '["2Y", "4Y", "6Y", "8Y", "10Y", "12Y", "14Y"]'::jsonb, true),
  ('One Size Fits All (OSFA)', 'Custom/Other', '["OSFA"]'::jsonb, true)
ON CONFLICT DO NOTHING;

-- 2. Ensure RLS policies allow insertion by authenticated users
DROP POLICY IF EXISTS "Users can insert custom size templates" ON public.size_templates;

CREATE POLICY "Users can insert custom size templates"
    ON public.size_templates FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);
