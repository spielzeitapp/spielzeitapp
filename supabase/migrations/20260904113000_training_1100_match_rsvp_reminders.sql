-- Einheitliche Erinnerungszeiten:
-- Training am Veranstaltungstag um 11:00 Europe/Vienna,
-- Match 48h und 24h vorher. Match-Empfänger werden im Worker auf offene RSVP gefiltert.

ALTER TABLE public.team_notification_settings
  ALTER COLUMN match_reminder_minutes_before SET DEFAULT 2880,
  ALTER COLUMN match_second_reminder_enabled SET DEFAULT true,
  ALTER COLUMN match_second_reminder_minutes_before SET DEFAULT 1440,
  ALTER COLUMN match_minutes_before SET DEFAULT 2880,
  ALTER COLUMN match_second_enabled SET DEFAULT true,
  ALTER COLUMN match_second_minutes_before SET DEFAULT 1440;

INSERT INTO public.team_notification_settings (team_season_id)
SELECT ts.id FROM public.team_seasons ts
ON CONFLICT (team_season_id) DO NOTHING;

UPDATE public.team_notification_settings
SET match_reminder_minutes_before = 2880,
    match_second_reminder_enabled = true,
    match_second_reminder_minutes_before = 1440;

CREATE OR REPLACE FUNCTION public.ensure_standard_team_reminder_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_notification_settings (team_season_id)
  VALUES (NEW.team_season_id)
  ON CONFLICT (team_season_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_events_ensure_standard_reminder_settings ON public.events;
CREATE TRIGGER aa_events_ensure_standard_reminder_settings
BEFORE INSERT OR UPDATE OF team_season_id
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.ensure_standard_team_reminder_settings();

CREATE OR REPLACE FUNCTION public.normalize_standard_event_reminder_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_now timestamptz := now();
  v_send_at timestamptz;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = NEW.id;
  IF NOT FOUND OR COALESCE(v_event.status, 'upcoming') <> 'upcoming' THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(v_event.kind, v_event.type, '')) = 'training' THEN
    v_send_at := ((v_event.starts_at AT TIME ZONE 'Europe/Vienna')::date + time '11:00')
      AT TIME ZONE 'Europe/Vienna';
    IF v_send_at <= v_now AND v_event.starts_at > v_now THEN
      v_send_at := v_now + interval '2 minutes';
    END IF;

    UPDATE public.notification_jobs
    SET send_at = v_send_at,
        dedupe_key = 'event:' || v_event.id::text || ':training_day_1100',
        payload = payload || jsonb_build_object(
          'reminderKey', 'training_day_1100',
          'reminder_type', 'training_day_1100',
          'offsetMinutes', 0,
          'schedule', 'training_day_1100'
        ),
        updated_at = v_now
    WHERE event_id = v_event.id
      AND kind = 'training'
      AND status IN ('pending', 'failed');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_events_normalize_standard_reminders ON public.events;
CREATE TRIGGER zz_events_normalize_standard_reminders
AFTER INSERT OR UPDATE OF starts_at, status, type, kind, team_season_id
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_standard_event_reminder_jobs();

-- Bestehende zukünftige Jobs in der Test-/Zieldatenbank neu aufbauen.
DO $$
DECLARE
  r record;
BEGIN
  -- Ältere Production-Schemas besitzen diese Hilfsfunktion noch nicht.
  -- In diesem Fall bleiben bestehende Jobs erhalten und werden unten direkt
  -- normalisiert; neue Jobs werden weiterhin vom Worker erzeugt.
  IF to_regprocedure('public.sync_notification_jobs_for_event(uuid)') IS NOT NULL THEN
    FOR r IN
      SELECT id FROM public.events
      WHERE COALESCE(status, 'upcoming') = 'upcoming' AND starts_at > now()
    LOOP
      EXECUTE 'SELECT public.sync_notification_jobs_for_event($1)' USING r.id;
    END LOOP;
  END IF;
END;
$$;

UPDATE public.notification_jobs j
SET send_at = GREATEST(
      ((e.starts_at AT TIME ZONE 'Europe/Vienna')::date + time '11:00') AT TIME ZONE 'Europe/Vienna',
      now() + interval '2 minutes'
    ),
    dedupe_key = 'event:' || e.id::text || ':training_day_1100',
    payload = j.payload || jsonb_build_object(
      'reminderKey', 'training_day_1100',
      'reminder_type', 'training_day_1100',
      'offsetMinutes', 0,
      'schedule', 'training_day_1100'
    ),
    updated_at = now()
FROM public.events e
WHERE j.event_id = e.id
  AND j.kind = 'training'
  AND j.status IN ('pending', 'failed')
  AND e.starts_at > now();

SELECT pg_notify('pgrst', 'reload schema');
