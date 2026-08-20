-- ==============================================================================
-- ORDER DETAIL PAGE PRODUCTION FIX: Batch Splitting Redesign + Real Document Storage
-- Migration: 20260824000000_order_batch_splitting_and_documents.sql
--
-- Context: src/routes/orders.$orderId.tsx's "Split into Batch" feature targeted
-- public.work_orders/blanket_pos (UUID-keyed tables) while passing order.order_id
-- (a human-readable text id) into a uuid column, crashing with
-- "invalid input syntax for type uuid". Deeper problem: no other live page
-- (cutting.tsx, sewing.tsx, qc.tsx, dispatch.tsx) reads or writes work_orders/
-- blanket_pos at all -- the whole shop-floor pipeline runs on public.orders by
-- its text order_id. work_orders/blanket_pos stays untouched here (it is used
-- correctly elsewhere by src/hooks/useConvertSubmission.ts, which creates real
-- blanket_pos rows first) -- this migration instead gives "Split into Batch" a
-- genuine home: child rows in public.orders itself, linked by parent_order_id,
-- so a split batch flows into the exact same live pipeline every other page
-- already reads.
--
-- No FK constraint on parent_order_id -> orders.order_id: public.orders
-- predates this repo's tracked migration history and its order_id column has
-- no confirmed UNIQUE/PRIMARY KEY constraint at the catalog level (the whole
-- app treats it as a natural key by convention, not by declared constraint).
-- Adding a hard FK here risks the same kind of migration failure documented in
-- 20260823000000's "SCHEMA-DRIFT INSURANCE" section if that assumption is
-- wrong. A plain text column matches how every other loose order_id reference
-- in this schema already works (materials.order_id, cutting.work_order_id).
-- ==============================================================================

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id text,
  ADD COLUMN IF NOT EXISTS flavor_route text,
  ADD COLUMN IF NOT EXISTS assigned_facility text,
  ADD COLUMN IF NOT EXISTS cut_sheet_document_url text;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON public.orders (parent_order_id);

-- ------------------------------------------------------------------------------
-- Real document storage for the Order Detail page's "Documents & Files" panel,
-- replacing a setTimeout-based upload simulation that never persisted anything.
-- Private bucket, signed-URL downloads only -- mirrors the tech-packs pattern
-- from 20260823000000. Path convention: {order_id}/po/{filename} and
-- {order_id}/cut-sheet/{filename}.
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-documents', 'order-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "order_documents_staff_all" ON storage.objects;
CREATE POLICY "order_documents_staff_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'order-documents' AND public.is_internal_staff())
  WITH CHECK (bucket_id = 'order-documents' AND public.is_internal_staff());

DROP POLICY IF EXISTS "order_documents_customer_read" ON storage.objects;
CREATE POLICY "order_documents_customer_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-documents' AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.order_id = (storage.foldername(name))[1]
      AND (
        o.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.name = o.customer_name AND c.id = public.get_auth_user_company_id()
        )
      )
    )
  );

-- Customers may also upload their own PO document (not the internal cut sheet
-- blueprint) to their own order's folder.
DROP POLICY IF EXISTS "order_documents_customer_upload_po" ON storage.objects;
CREATE POLICY "order_documents_customer_upload_po" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-documents' AND
    (storage.foldername(name))[2] = 'po' AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.order_id = (storage.foldername(name))[1]
      AND (
        o.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.name = o.customer_name AND c.id = public.get_auth_user_company_id()
        )
      )
    )
  );
