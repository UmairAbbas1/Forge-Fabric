-- F&F AI assistant: ReAct trajectories + human feedback (ReAct plan, Phase 4).
-- n8n logs every AI answer here with the service role (bypasses RLS). Users rate
-- their own answers through rate_ai_answer(); admins promote good corrections to
-- "learned corrections" that n8n injects into the assistant's prompt.

CREATE TABLE IF NOT EXISTS public.ai_react_trajectories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role TEXT NOT NULL DEFAULT 'staff',
    user_query TEXT NOT NULL,

    -- ReAct execution trace
    thoughts JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
    observations JSONB NOT NULL DEFAULT '[]'::jsonb,
    final_output TEXT NOT NULL,
    qa_status TEXT NOT NULL DEFAULT 'UNCHECKED',

    -- Human feedback
    human_rating SMALLINT CHECK (human_rating IN (-1, 1)), -- +1 accurate, -1 wrong / hallucination
    hallucination_flag BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_claim TEXT,
    human_correction TEXT,
    rated_at TIMESTAMPTZ,
    promoted_to_exemplar BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_react_trajectories ENABLE ROW LEVEL SECURITY;

-- Users see their own answers; admins see everything. (auth.jwt()->>'role' is always
-- 'authenticated' in Supabase, so the app role is checked via profiles instead.)
DROP POLICY IF EXISTS ai_traj_select ON public.ai_react_trajectories;
CREATE POLICY ai_traj_select ON public.ai_react_trajectories
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_user());

-- Only admins edit rows directly (e.g. promoting exemplars). Users rate via the function below.
DROP POLICY IF EXISTS ai_traj_admin_update ON public.ai_react_trajectories;
CREATE POLICY ai_traj_admin_update ON public.ai_react_trajectories
    FOR UPDATE TO authenticated
    USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- No INSERT/DELETE policy: rows are written only by n8n (service role).

CREATE INDEX IF NOT EXISTS idx_ai_react_rating ON public.ai_react_trajectories (human_rating, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_react_session ON public.ai_react_trajectories (session_id);
CREATE INDEX IF NOT EXISTS idx_ai_react_exemplars ON public.ai_react_trajectories (created_at DESC) WHERE promoted_to_exemplar;

-- A user rates one of THEIR OWN answers (thumbs up / down + optional one-line correction).
-- Only the feedback columns can change; the logged answer itself cannot be edited.
CREATE OR REPLACE FUNCTION public.rate_ai_answer(p_trace_id UUID, p_rating SMALLINT, p_correction TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_rating NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'rating must be 1 or -1';
  END IF;
  UPDATE public.ai_react_trajectories
     SET human_rating = p_rating,
         hallucination_flag = (p_rating = -1),
         human_correction = NULLIF(LEFT(TRIM(COALESCE(p_correction, '')), 500), ''),
         rated_at = NOW()
   WHERE id = p_trace_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_ai_answer(UUID, SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_ai_answer(UUID, SMALLINT, TEXT) TO authenticated;

-- Admin: promote (or un-promote) a corrected answer so the assistant learns it.
CREATE OR REPLACE FUNCTION public.promote_ai_exemplar(p_trace_id UUID, p_promote BOOLEAN DEFAULT TRUE)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'only admins can promote assistant corrections';
  END IF;
  UPDATE public.ai_react_trajectories
     SET promoted_to_exemplar = p_promote
   WHERE id = p_trace_id AND (NOT p_promote OR human_correction IS NOT NULL);
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_ai_exemplar(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_ai_exemplar(UUID, BOOLEAN) TO authenticated;
