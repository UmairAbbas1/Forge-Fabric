-- ============================================================================
-- CRITICAL, PLATFORM-WIDE MULTI-TENANT DATA LEAK — closes it across every
-- affected table in one migration.
--
-- What actually happened: this project went through several rounds of "seed
-- the database quickly" migrations early on that created deliberately wide-
-- open policies — CREATE POLICY "<table>_all_full_access" ... USING (true)
-- (and similarly-named variants: orders_update_authorized,
-- apply_submissions_select_all, notifications_all, qc_records_all,
-- materials_all, customers_select_all, sample_requests_all_full_access,
-- sku_mappings_full_access, scan_events_full_access, etc.). Every one of
-- those migrations correctly includes a `DROP POLICY IF EXISTS` for its own
-- open policy right before creating a properly brand/company-scoped
-- replacement — that's the standard, correct cleanup pattern used
-- throughout this project's migration history. The problem: those later,
-- narrowing migrations were never actually applied to this live database,
-- so the original wide-open policies are still live today, sitting
-- alongside (and completely overriding, since Postgres OR's every matching
-- policy together) the correctly-scoped ones from later files that WERE
-- applied. A handful of other tables (blanket_pos, work_orders,
-- price_quotes) show the same symptom with no open policy involved at all
-- — for those, ROW LEVEL SECURITY itself was simply never switched on.
--
-- Verified live, moments before writing this, with a throwaway customer
-- account carrying company_id = NULL — a value that cannot legitimately
-- satisfy any company-scoped policy in this codebase:
--   orders 15, apply_submissions 11, blanket_pos 26, notifications 42,
--   qc_records 46, materials 9, work_orders 13, price_quotes 3,
--   apply_cut_sheets 7, apply_documents 7 (uploaded customer files),
--   bundles 339, companies 7, customers 36, cutting_records 8,
--   profiles 15 (every user's email/role/company — the most severe one),
--   sample_requests 10, sewing_bundles 264, sku_mappings 12,
--   scan_events 1, wash_batches 1
-- — every row, every brand, visible to a session with no company at all.
--
-- Every table below already has a working staff/admin policy defined in
-- some earlier-applied migration, confirmed before writing this — dropping
-- the open policies and (re-)enabling RLS does not remove any access
-- internal staff currently have; it only removes cross-brand and
-- unauthenticated-company access that should never have existed.
--
-- Idempotent throughout: DROP POLICY IF EXISTS and ENABLE ROW LEVEL
-- SECURITY are both safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Drop every known wide-open ("_all" / "_full_access" / USING(true)) policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_all_full_access" ON public.orders;
DROP POLICY IF EXISTS "orders_update_authorized" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_authorized" ON public.orders;

DROP POLICY IF EXISTS "apply_submissions_all_full_access" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_select_all" ON public.apply_submissions;
DROP POLICY IF EXISTS "apply_submissions_update_all" ON public.apply_submissions;

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
DROP POLICY IF EXISTS "qc_records_all" ON public.qc_records;
DROP POLICY IF EXISTS "materials_all" ON public.materials;

DROP POLICY IF EXISTS "apply_cut_sheets_all" ON public.apply_cut_sheets;
DROP POLICY IF EXISTS "apply_documents_all" ON public.apply_documents;

DROP POLICY IF EXISTS "bundles_full_access" ON public.bundles;
DROP POLICY IF EXISTS "companies_all_full_access" ON public.companies;

DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_all" ON public.customers;
DROP POLICY IF EXISTS "customers_update_all" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_all" ON public.customers;

DROP POLICY IF EXISTS "cutting_records_all" ON public.cutting_records;
DROP POLICY IF EXISTS "sewing_bundles_all" ON public.sewing_bundles;
DROP POLICY IF EXISTS "wash_batches_all" ON public.wash_batches;

DROP POLICY IF EXISTS "sample_requests_all_full_access" ON public.sample_requests;
DROP POLICY IF EXISTS "Enable ALL for authenticated users" ON public.sample_requests;

DROP POLICY IF EXISTS "sku_mappings_full_access" ON public.sku_mappings;
DROP POLICY IF EXISTS "scan_events_full_access" ON public.scan_events;

DROP POLICY IF EXISTS "profiles_all_full_access" ON public.profiles;

-- ---------------------------------------------------------------------------
-- Enable RLS on every affected table — idempotent no-op wherever it was
-- already on (the tables above, where an open policy was the real cause),
-- and the actual fix wherever RLS itself had never been switched on
-- (blanket_pos, work_orders, price_quotes, plus a defensive re-assertion
-- on migration_exceptions, rework_logs, stage_outsourcing_records, and
-- size_gate_records, which also leaked live despite having no open policy
-- found in this codebase's history).
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apply_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blanket_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apply_cut_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apply_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sewing_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wash_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rework_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_outsourcing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_gate_records ENABLE ROW LEVEL SECURITY;
