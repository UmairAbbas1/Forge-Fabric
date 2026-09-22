-- ============================================================================
-- Adds 'outsourcing_staff' to the role_type enum — a dedicated, narrow role
-- for the standalone /outsourcing login (src/routes/outsourcing.tsx).
--
-- This role is deliberately NOT production_manager or any other real staff
-- role: it exists so this account's real database permissions can be as
-- narrow as the app's permission matrix allows (production_planning:update
-- only — see src/lib/permissions.ts), and so AppShell's hard redirect can
-- key off this exact role value to bounce the account out of every other
-- page in the app on sight, regardless of how it got there (the shared
-- /login screen, a direct URL, anything).
--
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction
-- block and cannot be rolled back — already applied live via
-- `supabase db query --linked`; this file just records it in migration
-- history so `supabase db push` / schema diffs stay accurate.
-- ============================================================================

ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'outsourcing_staff';
