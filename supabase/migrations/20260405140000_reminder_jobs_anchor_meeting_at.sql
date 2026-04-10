-- Reminder-Zeit: Offset von Treffpunkt (meeting_at) berechnen, falls gesetzt — sonst starts_at.
-- Gleiche absolute Zeitlogik (timestamptz); Anzeige bleibt Europe/Vienna im Worker.

CREATE OR REPLACE FUNCTION public.sync_notification_jobs_for_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_team_id uuid;
  v_now timestamptz := now();
  v_canonical_type text;
  v_training_enabled boolean;
  v_training_minutes integer;
  v_match_enabled boolean;
  v_match_minutes integer;
  v_match_second_enabled boolean;
  v_match_second_minutes integer;
  v_event_enabled boolean;
  v_event_minutes integer;
  v_send_at timestamptz;
  v_anchor timestamptz;
BEGIN
  SELECT e.*
  INTO v_event
  FROM public.events e
  WHERE e.id = p_event_id;

  IF NOT FOUND THEN
    RAISE LOG '[reminderPipeline] sync skip: event not found event_id=%', p_event_id;
    RETURN;
  END IF;

  SELECT ts.team_id INTO v_team_id
  FROM public.team_seasons ts
  WHERE ts.id = v_event.team_season_id;

  IF v_team_id IS NULL THEN
    RAISE LOG '[reminderPipeline] sync skip: team_id missing event_id=% team_season_id=%', v_event.id, v_event.team_season_id;
    RETURN;
  END IF;

  DELETE FROM public.notification_jobs j
  WHERE j.event_id = v_event.id
    AND j.status IN ('pending', 'failed');

  IF COALESCE(v_event.status, 'upcoming') <> 'upcoming' THEN
    RAISE LOG '[reminderPipeline] sync skip: event not upcoming event_id=% status=%', v_event.id, v_event.status;
    RETURN;
  END IF;

  v_anchor := COALESCE(v_event.meeting_at, v_event.starts_at);
  IF v_anchor IS NULL THEN
    RAISE LOG '[reminderPipeline] sync skip: no meeting_at/starts_at event_id=%', v_event.id;
    RETURN;
  END IF;

  IF v_anchor <= v_now THEN
    RAISE LOG '[reminderPipeline] sync skip: anchor in past event_id=% anchor=% now=%', v_event.id, v_anchor, v_now;
    RETURN;
  END IF;

  SELECT
    COALESCE(s.training_reminder_enabled, true),
    GREATEST(0, COALESCE(s.training_reminder_minutes_before, 120)),
    COALESCE(s.match_reminder_enabled, true),
    GREATEST(0, COALESCE(s.match_reminder_minutes_before, 1440)),
    COALESCE(s.match_second_reminder_enabled, false),
    GREATEST(0, COALESCE(s.match_second_reminder_minutes_before, 120)),
    COALESCE(s.event_reminder_enabled, false),
    GREATEST(0, COALESCE(s.event_reminder_minutes_before, 1440))
  INTO
    v_training_enabled,
    v_training_minutes,
    v_match_enabled,
    v_match_minutes,
    v_match_second_enabled,
    v_match_second_minutes,
    v_event_enabled,
    v_event_minutes
  FROM public.team_notification_settings s
  WHERE s.team_season_id = v_event.team_season_id;

  v_training_enabled := COALESCE(v_training_enabled, true);
  v_training_minutes := COALESCE(v_training_minutes, 120);
  v_match_enabled := COALESCE(v_match_enabled, true);
  v_match_minutes := COALESCE(v_match_minutes, 1440);
  v_match_second_enabled := COALESCE(v_match_second_enabled, false);
  v_match_second_minutes := COALESCE(v_match_second_minutes, 120);
  v_event_enabled := COALESCE(v_event_enabled, false);
  v_event_minutes := COALESCE(v_event_minutes, 1440);

  v_canonical_type := lower(COALESCE(v_event.type, ''));
  IF v_canonical_type NOT IN ('game', 'training', 'event', 'other') THEN
    IF lower(COALESCE(v_event.kind, '')) = 'training' THEN
      v_canonical_type := 'training';
    ELSIF lower(COALESCE(v_event.kind, '')) = 'event' THEN
      v_canonical_type := 'event';
    ELSE
      v_canonical_type := 'game';
    END IF;
  END IF;

  RAISE LOG '[reminderPipeline] event created/updated event_id=% type=% anchor_utc=%',
    v_event.id, v_canonical_type, v_anchor;

  IF v_canonical_type = 'training' AND v_training_enabled THEN
    v_send_at := GREATEST(v_anchor - make_interval(mins => v_training_minutes), v_now + interval '2 minutes');
    INSERT INTO public.notification_jobs(event_id, team_id, kind, send_at, payload, status, dedupe_key)
    VALUES (
      v_event.id,
      v_team_id,
      'training',
      v_send_at,
      jsonb_build_object(
        'reminderKey', 'training_' || v_training_minutes,
        'reminder_type', 'training_' || v_training_minutes,
        'offsetMinutes', v_training_minutes,
        'baseTimeIso', to_char(v_event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
      ),
      'pending',
      'event:' || v_event.id::text || ':training_' || v_training_minutes
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
    RAISE LOG '[reminderPipeline] job created event_id=% send_at_utc=% reminder=training_%',
      v_event.id, v_send_at, v_training_minutes;
  END IF;

  IF v_canonical_type = 'game' THEN
    IF v_match_enabled THEN
      v_send_at := GREATEST(v_anchor - make_interval(mins => v_match_minutes), v_now + interval '2 minutes');
      INSERT INTO public.notification_jobs(event_id, team_id, kind, send_at, payload, status, dedupe_key)
      VALUES (
        v_event.id,
        v_team_id,
        'match',
        v_send_at,
        jsonb_build_object(
          'reminderKey', 'match_' || v_match_minutes,
          'reminder_type', 'match_' || v_match_minutes,
          'offsetMinutes', v_match_minutes,
          'baseTimeIso', to_char(v_event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
        ),
        'pending',
        'event:' || v_event.id::text || ':match_' || v_match_minutes
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
      RAISE LOG '[reminderPipeline] job created event_id=% send_at_utc=% reminder=match_%',
        v_event.id, v_send_at, v_match_minutes;
    END IF;

    IF v_match_second_enabled THEN
      v_send_at := GREATEST(v_anchor - make_interval(mins => v_match_second_minutes), v_now + interval '2 minutes');
      INSERT INTO public.notification_jobs(event_id, team_id, kind, send_at, payload, status, dedupe_key)
      VALUES (
        v_event.id,
        v_team_id,
        'match',
        v_send_at,
        jsonb_build_object(
          'reminderKey', 'match_second_' || v_match_second_minutes,
          'reminder_type', 'match_second_' || v_match_second_minutes,
          'offsetMinutes', v_match_second_minutes,
          'baseTimeIso', to_char(v_event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
        ),
        'pending',
        'event:' || v_event.id::text || ':match_second_' || v_match_second_minutes
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
      RAISE LOG '[reminderPipeline] job created event_id=% send_at_utc=% reminder=match_second_%',
        v_event.id, v_send_at, v_match_second_minutes;
    END IF;
  END IF;

  IF v_canonical_type IN ('event', 'other') AND v_event_enabled THEN
    v_send_at := GREATEST(v_anchor - make_interval(mins => v_event_minutes), v_now + interval '2 minutes');
    INSERT INTO public.notification_jobs(event_id, team_id, kind, send_at, payload, status, dedupe_key)
    VALUES (
      v_event.id,
      v_team_id,
      'event',
      v_send_at,
      jsonb_build_object(
        'reminderKey', 'event_' || v_event_minutes,
        'reminder_type', 'event_' || v_event_minutes,
        'offsetMinutes', v_event_minutes,
        'baseTimeIso', to_char(v_event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
      ),
      'pending',
      'event:' || v_event.id::text || ':event_' || v_event_minutes
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
    RAISE LOG '[reminderPipeline] job created event_id=% send_at_utc=% reminder=event_%',
      v_event.id, v_send_at, v_event_minutes;
  END IF;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
