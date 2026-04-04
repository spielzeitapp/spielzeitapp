-- Reminder In-App: höchstens eine notifications-Zeile pro notification_job + Empfänger
-- + DISTINCT user_id aus memberships (mehrere Rollen/Zeilen → ein Eintrag pro User)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_notification_job_id uuid NULL
  REFERENCES public.notification_jobs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notifications.source_notification_job_id IS
  'notification_jobs.id für zeitbasierte Reminder; UNIQUE mit user_id verhindert Doppel-Inbox.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_job_recipient_unique
  ON public.notifications (source_notification_job_id, user_id)
  WHERE source_notification_job_id IS NOT NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_source_notification_job_id
  ON public.notifications (source_notification_job_id)
  WHERE source_notification_job_id IS NOT NULL;

-- Ein user_id pro team_season trotz mehrerer membership-Zeilen (z. B. mehrere Rollen)
CREATE OR REPLACE FUNCTION public.distinct_reminder_recipient_user_ids(p_team_season_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT m.user_id
  FROM public.memberships m
  WHERE m.team_season_id = p_team_season_id
    AND m.role::text IN ('trainer', 'co_trainer', 'head_coach', 'parent', 'player');
$$;

REVOKE ALL ON FUNCTION public.distinct_reminder_recipient_user_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distinct_reminder_recipient_user_ids(uuid) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
