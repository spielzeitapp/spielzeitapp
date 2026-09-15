-- Einziger Reminder-Scheduler: Supabase pg_cron -> Supabase Edge Function send-reminders.
-- Die projektspezifische Function-URL wird nach dem Deploy geschützt über die Management API
-- an configure_send_reminders_cron übergeben.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  v_old_job_id bigint;
BEGIN
  FOR v_old_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('send-reminders-job', 'invoke-send-reminders', 'send-reminders')
  LOOP
    PERFORM cron.unschedule(v_old_job_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.configure_send_reminders_cron(p_function_url text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, net
AS $$
DECLARE
  v_job_id bigint;
  v_old_job_id bigint;
  v_command text;
BEGIN
  IF p_function_url !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/send-reminders$' THEN
    RAISE EXCEPTION 'Ungültige Supabase send-reminders URL';
  END IF;

  FOR v_old_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('send-reminders-job', 'invoke-send-reminders', 'send-reminders')
  LOOP
    PERFORM cron.unschedule(v_old_job_id);
  END LOOP;

  v_command := format(
    'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb) AS request_id;',
    p_function_url,
    '{"Content-Type":"application/json"}',
    '{}'
  );

  SELECT cron.schedule('send-reminders-job', '* * * * *', v_command)
  INTO v_job_id;
  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_send_reminders_cron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.configure_send_reminders_cron(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_send_reminders_cron(text) TO service_role;

COMMENT ON FUNCTION public.configure_send_reminders_cron(text) IS
  'Konfiguriert den einzigen minütlichen Reminder-Cron auf die Supabase Edge Function.';

-- Vorhandene zukünftige Termine neu synchronisieren. Dadurch wird auch ein bereits fälliger,
-- bisher nicht versendeter Reminder kontrolliert auf now()+2 Minuten gesetzt.
DO $$
DECLARE
  r record;
BEGIN
  IF to_regprocedure('public.sync_notification_jobs_for_event(uuid)') IS NULL THEN
    RAISE EXCEPTION 'sync_notification_jobs_for_event(uuid) fehlt';
  END IF;

  FOR r IN
    SELECT id
    FROM public.events
    WHERE COALESCE(status, 'upcoming') = 'upcoming'
      AND starts_at > now()
  LOOP
    PERFORM public.sync_notification_jobs_for_event(r.id);
  END LOOP;
END;
$$;

-- sync_notification_jobs_for_event klemmt überfällige, aber noch sinnvolle Erinnerungen auf
-- now()+2 Minuten. Für diesen einmaligen Reparaturlauf werden genau diese Jobs sofort fällig,
-- damit der anschließend gestartete Worker den verpassten Reminder direkt verarbeitet.
UPDATE public.notification_jobs j
SET send_at = now(),
    updated_at = now()
FROM public.events e
WHERE e.id = j.event_id
  AND j.status = 'pending'
  AND COALESCE(e.status, 'upcoming') = 'upcoming'
  AND e.starts_at > now()
  AND j.send_at > now()
  AND j.send_at <= now() + interval '3 minutes';

SELECT pg_notify('pgrst', 'reload schema');
