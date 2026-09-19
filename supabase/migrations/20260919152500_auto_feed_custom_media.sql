-- Strukturierte Autoposts dürfen optional durch ein eigenes Bild ersetzt werden.
-- media_type und post_kind bleiben unverändert, damit Semantik, Daten und Links erhalten bleiben.
CREATE OR REPLACE FUNCTION public.update_auto_feed_post_media(
  p_post_id uuid,
  p_media_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.team_feed_posts%ROWTYPE;
  v_media_url text;
BEGIN
  SELECT * INTO v_post
  FROM public.team_feed_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beitrag nicht gefunden.');
  END IF;

  IF v_post.post_kind NOT IN (
    'matchday_today_auto',
    'matchday_tomorrow_auto',
    'next_match_auto',
    'live_auto',
    'lineup_auto',
    'squad_published',
    'result_auto',
    'tournament_completion_manual',
    'championship_schedule_published',
    'championship_match_changed'
  ) AND coalesce(v_post.media_type, '') NOT IN (
    'matchday',
    'next_match',
    'live',
    'lineup',
    'squad',
    'result',
    'tournament_completion',
    'championship_schedule',
    'championship_match_changed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dieser Beitrag ist kein unterstützter Autopost.');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_post.team_season_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Beitrags.' USING ERRCODE = '42501';
  END IF;

  v_media_url := nullif(trim(coalesce(p_media_url, '')), '');

  UPDATE public.team_feed_posts
  SET media_url = v_media_url,
      payload = CASE
        WHEN v_media_url IS NULL THEN coalesce(payload, '{}'::jsonb) - 'custom_auto_media_url' - 'custom_result_media_url'
        ELSE coalesce(payload, '{}'::jsonb) || jsonb_build_object('custom_auto_media_url', v_media_url)
      END
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true, 'media_url', v_media_url);
END;
$$;

REVOKE ALL ON FUNCTION public.update_auto_feed_post_media(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_feed_post_media(uuid, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
