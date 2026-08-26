-- Ergebnis-Feedposts nach einer Torschützenkorrektur aktualisieren.
-- Der dedupe_key bleibt unverändert; es wird kein zweiter Post angelegt.

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

  UPDATE public.team_feed_posts
  SET caption = COALESCE(p_caption, ''),
      payload = COALESCE(p_payload, '{}'::jsonb)
  WHERE dedupe_key = v_dedupe;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RETURN json_build_object('ok', true, 'created', false, 'reason', 'updated');
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

COMMENT ON FUNCTION public.ensure_result_feed_post_for_match(uuid, text, jsonb) IS
  'Erstellt den Ergebnis-Feedpost oder aktualisiert dessen Payload nach Torschützenkorrekturen.';

REVOKE ALL ON FUNCTION public.ensure_result_feed_post_for_match(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_result_feed_post_for_match(uuid, text, jsonb) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
