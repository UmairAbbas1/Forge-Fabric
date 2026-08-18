-- ==============================================================================
-- FORGE & FABRIC MES — PACKING LISTS & ADDRESS BOOK DEFINITIVE FIX
-- Fixes missing columns on public.packing_lists and cleans up address_book
-- ==============================================================================

-- 1. ADD MISSING COLUMNS TO PACKING_LISTS
ALTER TABLE IF EXISTS public.packing_lists
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS destination_address text,
  ADD COLUMN IF NOT EXISTS total_cartons numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_units numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carrier_name text DEFAULT 'FedEx Freight Express',
  ADD COLUMN IF NOT EXISTS tracking_reference text,
  ADD COLUMN IF NOT EXISTS pod_signature_ref text,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes text;

-- Remove strict foreign keys to allow custom order codes
ALTER TABLE IF EXISTS public.packing_lists DROP CONSTRAINT IF EXISTS packing_lists_destination_address_id_fkey;
ALTER TABLE IF EXISTS public.packing_lists DROP CONSTRAINT IF EXISTS packing_lists_purchase_order_id_fkey;
ALTER TABLE IF EXISTS public.packing_lists DROP CONSTRAINT IF EXISTS packing_lists_carrier_id_fkey;
ALTER TABLE IF EXISTS public.packing_lists ALTER COLUMN destination_address_id DROP NOT NULL;

-- 2. DROP RESTRICTIVE NOT-NULL & CHECK CONSTRAINTS ON ADDRESS_BOOK
ALTER TABLE IF EXISTS public.address_book DROP CONSTRAINT IF EXISTS address_book_company_id_fkey;
ALTER TABLE IF EXISTS public.address_book DROP CONSTRAINT IF EXISTS address_book_address_type_check;
ALTER TABLE IF EXISTS public.address_book ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.address_book
  ADD COLUMN IF NOT EXISTS address_label text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS street_1 text DEFAULT '1150 Industry Way',
  ADD COLUMN IF NOT EXISTS city text DEFAULT 'Los Angeles',
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS state_province text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS postal_code text DEFAULT '90040',
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS customer_name text;

-- 3. DEDUPLICATE & BACKFILL ADDRESS_BOOK ROWS
UPDATE public.address_book
SET 
  address_label = COALESCE(address_label, address_type || ' Receiving Dock', 'Primary DC'),
  street_1 = COALESCE(street_1, '1150 Industry Way, Commerce'),
  address_line1 = COALESCE(address_line1, street_1, '1150 Industry Way, Commerce'),
  city = COALESCE(city, 'Los Angeles'),
  state = COALESCE(state, 'CA'),
  state_province = COALESCE(state_province, state, 'CA'),
  postal_code = COALESCE(postal_code, '90040'),
  country = COALESCE(country, 'United States'),
  full_address = COALESCE(
    full_address,
    COALESCE(street_1, '1150 Industry Way, Commerce') || ', ' || COALESCE(city, 'Los Angeles') || ', ' || COALESCE(state, 'CA') || ' ' || COALESCE(postal_code, '90040')
  )
WHERE full_address IS NULL OR full_address LIKE '%null%';

-- Remove redundant identical duplicate rows, keeping only 1 unique row per address
DELETE FROM public.address_book a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (COALESCE(LOWER(customer_name), ''), COALESCE(LOWER(full_address), '')) id
  FROM public.address_book
  ORDER BY COALESCE(LOWER(customer_name), ''), COALESCE(LOWER(full_address), ''), created_at ASC
);

-- Remove unassigned generic duplicate placeholders
DELETE FROM public.address_book
WHERE (address_label = 'HQ Receiving Dock' OR customer_name IS NULL OR customer_name = 'null')
  AND (SELECT count(*) FROM public.address_book) > 5;

-- 4. INSERT STANDARD CUSTOMER DESTINATION ADDRESSES (ZERO DUPLICATES)
INSERT INTO public.address_book (address_label, street_1, address_line1, city, state, state_province, postal_code, country, full_address, customer_name, address_type)
VALUES 
  ('Servade Logistics Distribution Center', '45 Distribution Way', '45 Distribution Way', 'Elizabeth', 'NJ', 'NJ', '07201', 'United States', '45 Distribution Way, Elizabeth, NJ 07201', 'Servade', 'Shipping'),
  ('Levi Strauss & Co. Main DC #42', '1150 Industry Way', '1150 Industry Way', 'Commerce', 'CA', 'CA', '90040', 'United States', '1150 Industry Way, Commerce, CA 90040', 'Levi Strauss & Co.', 'Shipping'),
  ('Nudie Jeans Nordic Logistics Hub', 'Port of Goteborg Terminal 4', 'Port of Goteborg Terminal 4', 'Goteborg', 'Vastra Gotaland', 'Vastra Gotaland', '411 03', 'Sweden', 'Port of Goteborg Terminal 4, 411 03 Goteborg, Sweden', 'Nudie Jeans', 'Shipping'),
  ('Zara Denim Logistics Platform', 'Poligono Industrial Sabon 12', 'Poligono Industrial Sabon 12', 'Arteixo', 'A Coruna', 'A Coruna', '15142', 'Spain', 'Poligono Industrial Sabon 12, 15142 Arteixo, Spain', 'Zara Denim', 'Shipping'),
  ('Uniqlo Americas Central Warehouse', '8500 Logistics Blvd', '8500 Logistics Blvd', 'Dallas', 'TX', 'TX', '75261', 'United States', '8500 Logistics Blvd, Dallas, TX 75261', 'Uniqlo', 'Shipping'),
  ('Weissmade Logistics & Distribution Center', '742 Evergreen Terrace', '742 Evergreen Terrace', 'San Francisco', 'CA', 'CA', '94107', 'United States', '742 Evergreen Terrace, San Francisco, CA 94107', 'Weissmade', 'Shipping'),
  ('Fear of God Master Logistics Terminal', '900 N Michigan Ave', '900 N Michigan Ave', 'Chicago', 'IL', 'IL', '60611', 'United States', '900 N Michigan Ave, Suite 1400, Chicago, IL 60611', 'Fear of God', 'Shipping')
ON CONFLICT DO NOTHING;

-- 5. OPEN ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE IF EXISTS public.packing_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "packing_lists_full_access" ON public.packing_lists;
DROP POLICY IF EXISTS "packing_lists_staff_all" ON public.packing_lists;
DROP POLICY IF EXISTS "packing_lists_production" ON public.packing_lists;
CREATE POLICY "packing_lists_full_access" ON public.packing_lists
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.address_book ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "address_book_full_access" ON public.address_book;
DROP POLICY IF EXISTS "address_book_staff_all" ON public.address_book;
CREATE POLICY "address_book_full_access" ON public.address_book
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 6. REGISTER IN REALTIME PUBLICATION
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.packing_lists;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.address_book;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
