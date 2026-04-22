-- Team-Feed: automatischer Matchday-Post + idempotenter Push-Job (notification_jobs)
-- + sync_notification_jobs löscht pending matchday-Jobs nicht mehr bei Event-Updates

-- ---------------------------------------------------------------------------
-- team_feed_posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  post_kind text NOT NULL DEFAULT 'matchday_auto',
  caption text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_feed_posts_dedupe_key_unique UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_team_feed_posts_season_created
  ON public.team_feed_posts (team_season_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_feed_posts_event_id
  ON public.team_feed_posts (event_id);

COMMENT ON TABLE public.team_feed_posts IS 'Teamweiter Feed (z. B. Auto-Matchday); Lesen für Mitglieder der team_season.';
COMMENT ON COLUMN public.team_feed_posts.dedupe_key IS 'z. B. matchday_feed:<event_id> — idempotent';

ALTER TABLE public.team_feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_feed_posts_select_members" ON public.team_feed_posts;
CREATE POLICY "team_feed_posts_select_members"
  ON public.team_feed_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.team_season_id = team_feed_posts.team_season_id
        AND m.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.team_feed_posts TO authenticated;

-- ---------------------------------------------------------------------------
-- ensure_matchday_automation: Feed-Zeile + optional Push-Job (eine pro Spiel)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_matchday_automation(p_team_season_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_our_name text;
  v_event record;
  v_today date := (timezone('Europe/Vienna', now()))::date;
  v_home_name text;
  v_away_name text;
  v_caption text := 'Heute ist Matchday! 🔥';
  v_push_title text := 'Heute ist Matchday! 🔥';
  v_push_body text;
  v_link text;
  v_kickoff text;
  v_payload jsonb;
  v_opponent text;
  v_opp_logo text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.team_season_id = p_team_season_id AND m.user_id = v_uid
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'not_member');
  END IF;

  SELECT ts.team_id INTO v_team_id
  FROM public.team_seasons ts
  WHERE ts.id = p_team_season_id;

  IF v_team_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_team');
  END IF;

  SELECT t.name INTO v_our_name FROM public.teams t WHERE t.id = v_team_id;
  v_our_name := COALESCE(nullif(trim(v_our_name), ''), 'Team');

  SELECT e INTO v_event
  FROM public.events e
  WHERE e.team_season_id = p_team_season_id
    AND lower(COALESCE(e.kind, '')) = 'match'
    AND (timezone('Europe/Vienna', e.starts_at))::date = v_today
    AND COALESCE(e.status, 'upcoming') <> 'canceled'
  ORDER BY e.starts_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'no_match_today');
  END IF;

  v_opponent := COALESCE(nullif(trim(v_event.opponent), ''), 'Gegner');
  v_opp_logo := nullif(trim(COALESCE(v_event.opponent_logo_url, '')), '');

  IF COALESCE(v_event.is_home, true) THEN
    v_home_name := v_our_name;
    v_away_name := v_opponent;
  ELSE
    v_home_name := v_opponent;
    v_away_name := v_our_name;
  END IF;

  v_kickoff := to_char(timezone('Europe/Vienna', v_event.starts_at), 'HH24:MI');

  v_push_body := format(
    '%s vs. %s – Anpfiff %s Uhr',
    v_our_name,
    v_opponent,
    v_kickoff
  );

  IF v_event.match_id IS NOT NULL AND trim(v_event.match_id::text) <> '' THEN
    v_link := '/app/match/' || v_event.match_id::text;
  ELSE
    v_link := '/app/events/' || v_event.id::text;
  END IF;

  v_payload := jsonb_build_object(
    'display_home_name', v_home_name,
    'display_away_name', v_away_name,
    'our_team_name', v_our_name,
    'is_home', COALESCE(v_event.is_home, true),
    'opponent_logo_url', v_opp_logo,
    'match_type', v_event.match_type,
    'kickoff_iso', to_char(v_event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'meeting_iso', CASE
      WHEN v_event.meeting_at IS NULL THEN NULL
      ELSE to_char(v_event.meeting_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    END,
    'location', COALESCE(nullif(trim(v_event.location), ''), ''),
    'address', COALESCE(nullif(trim(v_event.address), ''), ''),
    'match_id', v_event.match_id,
    'event_id', v_event.id,
    'deep_link', v_link
  );

  INSERT INTO public.team_feed_posts (
    team_season_id,
    team_id,
    event_id,
    post_kind,
    caption,
    payload,
    dedupe_key
  )
  VALUES (
    p_team_season_id,
    v_team_id,
    v_event.id,
    'matchday_auto',
    v_caption,
    v_payload,
    'matchday_feed:' || v_event.id::text
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  IF COALESCE(v_event.status, 'upcoming') IN ('upcoming', 'live') THEN
    INSERT INTO public.notification_jobs (
      event_id,
      team_id,
      kind,
      send_at,
      payload,
      status,
      dedupe_key
    )
    VALUES (
      v_event.id,
      v_team_id,
      'match',
      now(),
      jsonb_build_object(
        'automation', 'matchday_post',
        'pushTitle', v_push_title,
        'pushBody', v_push_body,
        'linkPath', v_link,
        'reminderKey', 'matchday_auto',
        'offsetMinutes', 0,
        'baseTimeIso', to_char(v_event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ),
      'pending',
      'matchday_auto_push:' || v_event.id::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'event_id', v_event.id,
    'dedupe_feed', 'matchday_feed:' || v_event.id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_matchday_automation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_matchday_automation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_matchday_automation(uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_matchday_automation IS
  'Legt höchstens einen Matchday-Feed-Post und einen Matchday-Push-Job pro Event an (idempotent).';

-- ---------------------------------------------------------------------------
-- Reminder-Sync: Matchday-Jobs nicht mitlöschen
-- ---------------------------------------------------------------------------
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
    AND j.status IN ('pending', 'failed')
    AND COALESCE(j.payload->>'automation', '') <> 'matchday_post';

  IF COALESCE(v_event.status, 'upcoming') <> 'upcoming' THEN
    RAISE LOG '[reminderPipeline] sync skip: event not upcoming event_id=% status=%', v_event.id, v_event.status;
    RETURN;
  END IF;

  IF v_event.starts_at IS NULL THEN
    RAISE LOG '[reminderPipeline] sync skip: starts_at missing event_id=%', v_event.id;
    RETURN;
  END IF;

  IF v_event.starts_at <= v_now THEN
    RAISE LOG '[reminderPipeline] sync skip: starts_at in past event_id=% starts_at=% now=%', v_event.id, v_event.starts_at, v_now;
    RETURN;
  END IF;

  SELECT
    COALESCE(s.training_enabled, s.training_reminder_enabled, true),
    GREATEST(0, COALESCE(s.training_minutes_before, s.training_reminder_minutes_before, 120)),
    COALESCE(s.match_enabled, s.match_reminder_enabled, true),
    GREATEST(0, COALESCE(s.match_minutes_before, s.match_reminder_minutes_before, 1440)),
    COALESCE(s.match_second_enabled, s.match_second_reminder_enabled, false),
    GREATEST(0, COALESCE(s.match_second_minutes_before, s.match_second_reminder_minutes_before, 120)),
    COALESCE(s.event_enabled, s.event_reminder_enabled, false),
    GREATEST(0, COALESCE(s.event_minutes_before, s.event_reminder_minutes_before, 1440))
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

  RAISE LOG '[reminderPipeline] event created/updated event_id=% type=% starts_at_utc=%',
    v_event.id, v_canonical_type, v_event.starts_at;

  IF v_canonical_type = 'training' AND v_training_enabled THEN
    v_send_at := GREATEST(v_event.starts_at - make_interval(mins => v_training_minutes), v_now + interval '2 minutes');
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
      v_send_at := GREATEST(v_event.starts_at - make_interval(mins => v_match_minutes), v_now + interval '2 minutes');
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
      v_send_at := GREATEST(v_event.starts_at - make_interval(mins => v_match_second_minutes), v_now + interval '2 minutes');
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
    v_send_at := GREATEST(v_event.starts_at - make_interval(mins => v_event_minutes), v_now + interval '2 minutes');
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
