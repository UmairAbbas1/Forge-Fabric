-- ============================================================================
-- AUDIT LOGS — records sensitive admin actions (user invited, role changed,
-- user suspended/reactivated) with actor, target, action, and timestamp.
-- Mirrors the existing notification_logs pattern: RLS-enabled, admin-only
-- read, insert restricted to the acting admin themselves, no update/delete
-- policies at all — the log is intentionally immutable from the client.
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email VARCHAR(150),
    action VARCHAR(50) NOT NULL,
        -- 'user_invited' | 'role_changed' | 'user_suspended' | 'user_reactivated'
    target_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_email VARCHAR(150),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON public.audit_logs (target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins may read the audit trail.
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin_user());

-- Only admins may write entries, and only attributed to themselves — this is
-- enforced at the database layer independent of the frontend, per this
-- project's RLS-is-the-real-boundary convention. No UPDATE/DELETE policy
-- exists for any role: once written, a log entry cannot be altered or
-- removed via the client.
DROP POLICY IF EXISTS "audit_logs_admin_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user() AND actor_id = auth.uid());
