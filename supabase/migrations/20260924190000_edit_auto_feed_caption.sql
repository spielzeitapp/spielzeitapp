-- Trainer können Bild und Text eines Autoposts gemeinsam ändern.
CREATE OR REPLACE FUNCTION public.update_auto_feed_post(
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
  v_media_url text;
  v_caption text;
BEGIN
  SELECT * INTO v_post FROM public.team_feed_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beitrag nicht gefunden.');
  END IF;

  IF v_post.post_kind NOT IN (
    'matchday_today_auto', 'matchday_tomorrow_auto', 'next_match_auto',
    'live_auto', 'lineup_auto', 'squad_published', 'result_auto',
    'tournament_completion_manual', 'championship_schedule_published',
    'championship_match_changed'
  ) AND coalesce(v_post.media_type, '') NOT IN (
    'matchday', 'next_match', 'live', 'lineup', 'squad', 'result',
    'tournament_completion', 'championship_schedule', 'championship_match_changed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dieser Beitrag kann hier nicht bearbeitet werden.');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_post.team_season_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Beitrags.' USING ERRCODE = '42501';
  END IF;

  v_caption := trim(coalesce(p_caption, ''));
  IF length(v_caption) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Der Text darf maximal 2000 Zeichen lang sein.');
  END IF;
  v_media_url := nullif(trim(coalesce(p_media_url, '')), '');

  UPDATE public.team_feed_posts
  SET caption = v_caption,
      media_url = v_media_url,
      payload = (
        CASE WHEN v_media_url IS NULL
          THEN coalesce(v_post.payload, '{}'::jsonb) - 'custom_auto_media_url' - 'custom_result_media_url'
          ELSE coalesce(v_post.payload, '{}'::jsonb) || jsonb_build_object('custom_auto_media_url', v_media_url)
        END
      ) || CASE WHEN v_post.post_kind = 'result_auto' AND v_caption IS DISTINCT FROM v_post.caption
             THEN jsonb_build_object('caption_edited', true)
             ELSE '{}'::jsonb END
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_auto_feed_post(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_feed_post(uuid, text, text) TO authenticated;

-- Bei späteren Torschützenkorrekturen wird der Ergebnispost aktualisiert.
-- Ein manuell bearbeiteter Begleittext bleibt dabei erhalten.
CREATE OR REPLACE FUNCTION public.preserve_result_feed_caption()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.post_kind = 'result_auto'
     AND coalesce(OLD.payload->>'caption_edited', 'false') = 'true'
     AND NEW.caption IS DISTINCT FROM OLD.caption
     AND coalesce(NEW.payload->>'caption_edited', 'false') <> 'true' THEN
    NEW.caption := OLD.caption;
    NEW.payload := coalesce(NEW.payload, '{}'::jsonb) || jsonb_build_object('caption_edited', true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_result_feed_caption_on_update ON public.team_feed_posts;
CREATE TRIGGER preserve_result_feed_caption_on_update
BEFORE UPDATE ON public.team_feed_posts
FOR EACH ROW EXECUTE FUNCTION public.preserve_result_feed_caption();

SELECT pg_notify('pgrst', 'reload schema');
