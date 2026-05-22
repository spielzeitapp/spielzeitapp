-- Production hatte noch alte delete_team_feed_post_v2 ohne dedupe_key/Suppression.
-- Fix: SELECT dedupe_key + team_season_id VOR DELETE, dann UPSERT, dann DELETE.
-- Debug-Felder in JSON (temporär zur Verifikation).

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
  v_suppression_written boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id, t.dedupe_key
  INTO v_ts, v_dedupe
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'not_found',
      'dedupe_key_found', NULL,
      'suppression_written', false
    );
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'forbidden',
      'dedupe_key_found', v_dedupe,
      'suppression_written', false
    );
  END IF;

  IF v_dedupe IS NOT NULL
     AND (v_dedupe LIKE 'result_feed:%' OR v_dedupe LIKE 'matchday_feed:%') THEN
    INSERT INTO public.team_feed_dedupe_suppressions (dedupe_key, team_season_id, suppressed_by)
    VALUES (v_dedupe, v_ts, v_uid)
    ON CONFLICT (dedupe_key) DO UPDATE SET
      team_season_id = EXCLUDED.team_season_id,
      suppressed_at = now(),
      suppressed_by = EXCLUDED.suppressed_by;
    v_suppression_written := true;
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'already_gone',
      'dedupe_key_found', v_dedupe,
      'suppression_written', v_suppression_written
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'deleted', true,
    'dedupe_key_found', v_dedupe,
    'suppression_written', v_suppression_written
  );
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
  v_suppression_written boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id, t.dedupe_key
  INTO v_ts, v_dedupe
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'not_found',
      'dedupe_key_found', NULL,
      'suppression_written', false
    );
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'forbidden',
      'dedupe_key_found', v_dedupe,
      'suppression_written', false
    );
  END IF;

  IF v_dedupe IS NOT NULL
     AND (v_dedupe LIKE 'result_feed:%' OR v_dedupe LIKE 'matchday_feed:%') THEN
    INSERT INTO public.team_feed_dedupe_suppressions (dedupe_key, team_season_id, suppressed_by)
    VALUES (v_dedupe, v_ts, v_uid)
    ON CONFLICT (dedupe_key) DO UPDATE SET
      team_season_id = EXCLUDED.team_season_id,
      suppressed_at = now(),
      suppressed_by = EXCLUDED.suppressed_by;
    v_suppression_written := true;
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object(
      'ok', true,
      'deleted', false,
      'reason', 'already_gone',
      'dedupe_key_found', v_dedupe,
      'suppression_written', v_suppression_written
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'deleted', true,
    'dedupe_key_found', v_dedupe,
    'suppression_written', v_suppression_written
  );
END;
$$;

COMMENT ON FUNCTION public.delete_team_feed_post_v2(uuid) IS
  'Löscht Feed-Post; lädt dedupe_key vor DELETE, schreibt Suppression für result_feed:/matchday_feed:.';

SELECT pg_notify('pgrst', 'reload schema');
