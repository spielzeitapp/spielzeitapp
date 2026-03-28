-- Job-basiertes Reminder-System (kein Cron in dieser Migration)
-- + optionale Metadaten an messages für Badges / Lesestatus

-- ---------------------------------------------------------------------------
-- messages: read_at + notification_kind (Termin-Klassifikation)
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS notification_kind text NULL;

COMMENT ON COLUMN public.messages.read_at IS 'Zeitpunkt „gelesen“ (Server)';
COMMENT ON COLUMN public.messages.notification_kind IS 'match | training | event — für Badge-Filter';

CREATE INDEX IF NOT EXISTS idx_messages_user_unread
  ON public.messages (user_id, created_at DESC)
  WHERE user_id IS NOT NULL AND read IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- notification_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('match', 'training', 'event')),
  send_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  dedupe_key text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_jobs_dedupe_key_unique UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_status_send_at
  ON public.notification_jobs (status, send_at);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_event_id
  ON public.notification_jobs (event_id);

DROP TRIGGER IF EXISTS trg_notification_jobs_updated_at ON public.notification_jobs;
CREATE TRIGGER trg_notification_jobs_updated_at
  BEFORE UPDATE ON public.notification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_jobs_select_event_members" ON public.notification_jobs;
CREATE POLICY "notification_jobs_select_event_members"
  ON public.notification_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = notification_jobs.event_id
        AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notification_jobs_write_trainer_admin" ON public.notification_jobs;
CREATE POLICY "notification_jobs_write_trainer_admin"
  ON public.notification_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = notification_jobs.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
    AND EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.team_seasons ts ON ts.id = e.team_season_id
      WHERE e.id = notification_jobs.event_id
        AND ts.team_id = notification_jobs.team_id
    )
  );

DROP POLICY IF EXISTS "notification_jobs_update_trainer_admin" ON public.notification_jobs;
CREATE POLICY "notification_jobs_update_trainer_admin"
  ON public.notification_jobs
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = notification_jobs.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = notification_jobs.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "notification_jobs_delete_trainer_admin" ON public.notification_jobs;
CREATE POLICY "notification_jobs_delete_trainer_admin"
  ON public.notification_jobs
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = notification_jobs.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- ---------------------------------------------------------------------------
-- claim_notification_job — nur Service Role (Vercel Worker)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_job(p_job_id uuid)
RETURNS SETOF public.notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_jobs j
  SET
    status = 'processing',
    attempt_count = j.attempt_count + 1,
    last_error = NULL,
    updated_at = now()
  WHERE j.id = p_job_id
    AND j.send_at <= now()
    AND j.status IN ('pending', 'failed')
    AND j.attempt_count < 5
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_job(uuid) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
