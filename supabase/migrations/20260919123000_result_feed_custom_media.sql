-- Ergebnis-Autopost: optionales Siegerbild nachträglich setzen/entfernen.
-- media_type bleibt "result", damit der Beitrag seine Ergebnis-Semantik behält.
CREATE OR REPLACE FUNCTION public.update_result_feed_post_media(
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

  IF v_post.post_kind <> 'result_auto' AND coalesce(v_post.media_type, '') <> 'result' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nur Ergebnis-Autoposts können hier bearbeitet werden.');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_post.team_season_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Beitrags.' USING ERRCODE = '42501';
  END IF;

  v_media_url := nullif(trim(coalesce(p_media_url, '')), '');

  UPDATE public.team_feed_posts
  SET media_url = v_media_url,
      payload = CASE
        WHEN v_media_url IS NULL THEN coalesce(payload, '{}'::jsonb) - 'custom_result_media_url'
        ELSE coalesce(payload, '{}'::jsonb) || jsonb_build_object('custom_result_media_url', v_media_url)
      END
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true, 'media_url', v_media_url);
END;
$$;

REVOKE ALL ON FUNCTION public.update_result_feed_post_media(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_result_feed_post_media(uuid, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
