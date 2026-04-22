-- Matchday-Feed: Post ca. 1 Kalendertag vor Anpfiff (Europe/Vienna) + Catch-up am Spieltag,
-- wenn noch kein Post existiert. Kein automatischer notification_job mehr (Push separat/testweise).

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
  v_match_day date;
  v_home_name text;
  v_away_name text;
  v_caption text;
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
    AND COALESCE(e.status, 'upcoming') <> 'canceled'
    AND COALESCE(e.status, 'upcoming') IN ('upcoming', 'live')
    AND (
      (timezone('Europe/Vienna', e.starts_at))::date = v_today + 1
      OR (timezone('Europe/Vienna', e.starts_at))::date = v_today
    )
  ORDER BY
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.team_feed_posts t
        WHERE t.dedupe_key = ('matchday_feed:' || e.id::text)
      ) THEN 1
      ELSE 0
    END,
    CASE
      WHEN (timezone('Europe/Vienna', e.starts_at))::date = v_today THEN 0
      ELSE 1
    END,
    e.starts_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'no_eligible_match');
  END IF;

  v_match_day := (timezone('Europe/Vienna', v_event.starts_at))::date;
  IF v_match_day = v_today THEN
    v_caption := 'Heute ist Matchday! 🔥';
  ELSE
    v_caption := 'Morgen ist Matchday! 🔥';
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

  RETURN json_build_object(
    'ok', true,
    'event_id', v_event.id,
    'dedupe_feed', 'matchday_feed:' || v_event.id::text
  );
END;
$$;

COMMENT ON FUNCTION public.ensure_matchday_automation IS
  'Legt höchstens einen Matchday-Feed-Post pro Spiel an (idempotent), wenn Spieltag morgen ist oder Catch-up am Spieltag.';

SELECT pg_notify('pgrst', 'reload schema');
