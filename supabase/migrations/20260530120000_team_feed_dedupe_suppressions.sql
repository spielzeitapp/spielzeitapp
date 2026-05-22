-- Manuell gelöschte Auto-Feed-Posts (result_feed:/matchday_feed:) nicht erneut anlegen.

CREATE TABLE IF NOT EXISTS public.team_feed_dedupe_suppressions (
  dedupe_key text PRIMARY KEY,
  team_season_id uuid REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  suppressed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);

COMMENT ON TABLE public.team_feed_dedupe_suppressions IS
  'Nach manuellem Delete von Auto-Posts: dedupe_key blockiert ensure_* Recreation.';

CREATE INDEX IF NOT EXISTS idx_team_feed_dedupe_suppressions_season
  ON public.team_feed_dedupe_suppressions (team_season_id);

ALTER TABLE public.team_feed_dedupe_suppressions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.team_feed_dedupe_suppressions FROM PUBLIC;
REVOKE ALL ON TABLE public.team_feed_dedupe_suppressions FROM authenticated;
REVOKE ALL ON TABLE public.team_feed_dedupe_suppressions FROM anon;

-- ---------------------------------------------------------------------------
-- delete_team_feed_post / v2: suppression vor DELETE für Auto-dedupe_keys
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_team_feed_post(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_dedupe text;
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id, t.dedupe_key
  INTO v_ts, v_dedupe
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_dedupe IS NOT NULL
     AND (v_dedupe LIKE 'result_feed:%' OR v_dedupe LIKE 'matchday_feed:%') THEN
    INSERT INTO public.team_feed_dedupe_suppressions (dedupe_key, team_season_id, suppressed_by)
    VALUES (v_dedupe, v_ts, v_uid)
    ON CONFLICT (dedupe_key) DO UPDATE SET
      team_season_id = EXCLUDED.team_season_id,
      suppressed_at = now(),
      suppressed_by = EXCLUDED.suppressed_by;
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'already_gone');
  END IF;

  RETURN json_build_object('ok', true, 'deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_team_feed_post_v2(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_dedupe text;
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id, t.dedupe_key
  INTO v_ts, v_dedupe
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_dedupe IS NOT NULL
     AND (v_dedupe LIKE 'result_feed:%' OR v_dedupe LIKE 'matchday_feed:%') THEN
    INSERT INTO public.team_feed_dedupe_suppressions (dedupe_key, team_season_id, suppressed_by)
    VALUES (v_dedupe, v_ts, v_uid)
    ON CONFLICT (dedupe_key) DO UPDATE SET
      team_season_id = EXCLUDED.team_season_id,
      suppressed_at = now(),
      suppressed_by = EXCLUDED.suppressed_by;
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'already_gone');
  END IF;

  RETURN json_build_object('ok', true, 'deleted', true);
END;
$$;

COMMENT ON FUNCTION public.delete_team_feed_post_v2(uuid) IS
  'Löscht Feed-Post; result_feed:/matchday_feed: dedupe_key wird unterdrückt (keine Auto-Recreation).';

-- ---------------------------------------------------------------------------
-- ensure_result_feed_post_for_match
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_result_feed_post_for_match(
  p_match_id uuid,
  p_caption text,
  p_payload jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match public.matches%ROWTYPE;
  v_team_id uuid;
  v_event_id uuid;
  v_dedupe text;
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'match_not_found');
  END IF;

  IF v_match.status IS DISTINCT FROM 'finished' THEN
    RETURN json_build_object('ok', true, 'created', false, 'reason', 'not_finished');
  END IF;

  IF NOT (
    public.match_staff_can_write_for_match(p_match_id)
    OR public.can_insert_team_feed_post(v_match.team_season_id)
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_dedupe := 'result_feed:' || p_match_id::text;

  IF EXISTS (
    SELECT 1 FROM public.team_feed_dedupe_suppressions s WHERE s.dedupe_key = v_dedupe
  ) THEN
    RETURN json_build_object('ok', true, 'created', false, 'reason', 'suppressed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_feed_posts t WHERE t.dedupe_key = v_dedupe) THEN
    RETURN json_build_object('ok', true, 'created', false, 'reason', 'already_exists');
  END IF;

  SELECT ts.team_id INTO v_team_id
  FROM public.team_seasons ts
  WHERE ts.id = v_match.team_season_id;

  IF v_team_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_team_id');
  END IF;

  SELECT e.id INTO v_event_id
  FROM public.events e
  WHERE e.match_id = p_match_id
  ORDER BY e.starts_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO public.team_feed_posts (
    team_season_id,
    team_id,
    event_id,
    post_kind,
    caption,
    payload,
    dedupe_key,
    media_type,
    media_url,
    thumbnail_url,
    duration_seconds,
    created_by
  )
  VALUES (
    v_match.team_season_id,
    v_team_id,
    v_event_id,
    'result_auto',
    COALESCE(p_caption, ''),
    COALESCE(p_payload, '{}'::jsonb),
    v_dedupe,
    'result',
    NULL,
    NULL,
    NULL,
    v_uid
  );

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN json_build_object('ok', true, 'created', v_rows > 0);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('ok', true, 'created', false, 'reason', 'duplicate_race');
END;
$$;

-- ---------------------------------------------------------------------------
-- ensure_matchday_automation
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
  v_event public.events%ROWTYPE;
  v_dedupe text;
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
  v_rows int;
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

  SELECT *
  INTO v_event
  FROM public.events e
  WHERE e.team_season_id = p_team_season_id
    AND (
      lower(coalesce(e.kind, '')) = 'match'
      OR lower(coalesce(e.type, '')) IN ('match', 'game')
    )
    AND COALESCE(e.status, 'upcoming') <> 'canceled'
    AND COALESCE(e.status, 'upcoming') IN ('upcoming', 'live')
    AND (timezone('Europe/Vienna', e.starts_at))::date >= v_today
    AND (timezone('Europe/Vienna', e.starts_at))::date <= v_today + 14
  ORDER BY
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.team_feed_posts t
        WHERE t.dedupe_key = ('matchday_feed:' || e.id::text)
      )
      OR EXISTS (
        SELECT 1 FROM public.team_feed_dedupe_suppressions s
        WHERE s.dedupe_key = ('matchday_feed:' || e.id::text)
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

  v_dedupe := 'matchday_feed:' || v_event.id::text;

  IF EXISTS (
    SELECT 1 FROM public.team_feed_dedupe_suppressions s WHERE s.dedupe_key = v_dedupe
  ) THEN
    RETURN json_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'suppressed',
      'event_id', v_event.id,
      'dedupe_feed', v_dedupe
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_feed_posts t WHERE t.dedupe_key = v_dedupe
  ) THEN
    RETURN json_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_exists',
      'event_id', v_event.id,
      'dedupe_feed', v_dedupe
    );
  END IF;

  v_match_day := (timezone('Europe/Vienna', v_event.starts_at))::date;
  IF v_match_day = v_today THEN
    v_caption := 'Heute ist Matchday! 🔥';
  ELSIF v_match_day = v_today + 1 THEN
    v_caption := 'Morgen ist Matchday! 🔥';
  ELSE
    v_caption := 'Matchday steht bevor! 🔥';
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
    v_dedupe
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN json_build_object(
    'ok', true,
    'event_id', v_event.id,
    'dedupe_feed', v_dedupe,
    'rows_inserted', v_rows
  );
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
