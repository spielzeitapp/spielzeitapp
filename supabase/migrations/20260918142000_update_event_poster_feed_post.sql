CREATE OR REPLACE FUNCTION public.update_event_poster_feed_post(
  p_post_id uuid,
  p_caption text,
  p_media_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.team_feed_posts%ROWTYPE;
BEGIN
  SELECT * INTO v_post FROM public.team_feed_posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beitrag nicht gefunden.');
  END IF;
  IF v_post.post_kind <> 'event_poster_manual' OR v_post.event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nur manuelle Terminbilder können bearbeitet werden.');
  END IF;
  IF NOT public.can_delete_team_feed_post(v_post.team_season_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Beitrags.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_media_url, ''))) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ein Bild ist erforderlich.');
  END IF;

  UPDATE public.team_feed_posts
  SET caption = trim(coalesce(p_caption, '')),
      media_url = trim(p_media_url),
      payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('storage_path', trim(p_media_url))
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_event_poster_feed_post(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_poster_feed_post(uuid, text, text) TO authenticated;
SELECT pg_notify('pgrst', 'reload schema');
