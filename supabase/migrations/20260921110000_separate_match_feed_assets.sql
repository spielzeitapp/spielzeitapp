-- Eigene Medien und Begleittexte für Spieltag, Kader und Aufstellung.
ALTER TABLE public.event_feed_settings
  ADD COLUMN IF NOT EXISTS squad_poster_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS squad_caption_override text NULL,
  ADD COLUMN IF NOT EXISTS squad_feed_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lineup_poster_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS lineup_caption_override text NULL,
  ADD COLUMN IF NOT EXISTS lineup_feed_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.event_feed_settings.squad_poster_storage_path IS
  'Eigenes Kaderposter; wird bei Kaderfreigabe in den Feedpost übernommen.';
COMMENT ON COLUMN public.event_feed_settings.lineup_poster_storage_path IS
  'Eigenes Aufstellungsposter; wird bei Aufstellungsfreigabe in den Feedpost übernommen.';

-- Der App-Flow nutzt diese Signatur. Der bestehende Kern erstellt Kader, Push-Jobs und Feedpost;
-- danach werden die optionalen Kader-Feed-Einstellungen angewendet.
CREATE OR REPLACE FUNCTION public.publish_match_squad(
  p_match_id uuid,
  p_selected_message text,
  p_not_selected_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_version integer;
  v_selected_message text;
  v_not_selected_message text;
  v_event_id uuid;
  v_caption text;
  v_media text;
  v_feed_enabled boolean := true;
BEGIN
  v_result := public.publish_match_squad(p_match_id);

  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_version := coalesce((v_result ->> 'version')::integer, 1);
  v_selected_message := nullif(left(btrim(p_selected_message), 500), '');
  v_not_selected_message := nullif(left(btrim(p_not_selected_message), 500), '');

  IF v_selected_message IS NOT NULL THEN
    UPDATE public.notification_jobs
    SET payload = jsonb_set(payload, '{pushBody}', to_jsonb(v_selected_message), true)
    WHERE dedupe_key = 'squad-selected:' || p_match_id::text || ':v' || v_version::text
      AND status = 'pending';
  END IF;

  IF v_not_selected_message IS NOT NULL THEN
    UPDATE public.notification_jobs
    SET payload = jsonb_set(payload, '{pushBody}', to_jsonb(v_not_selected_message), true)
    WHERE dedupe_key = 'squad-not-selected:' || p_match_id::text || ':v' || v_version::text
      AND status = 'pending';
  END IF;

  SELECT e.id INTO v_event_id
  FROM public.events e
  WHERE e.match_id = p_match_id
  ORDER BY e.starts_at ASC
  LIMIT 1;

  SELECT nullif(btrim(efs.squad_caption_override), ''),
         nullif(btrim(efs.squad_poster_storage_path), ''),
         coalesce(efs.squad_feed_enabled, true)
  INTO v_caption, v_media, v_feed_enabled
  FROM public.event_feed_settings efs
  WHERE efs.event_id = v_event_id;

  IF v_feed_enabled IS NOT TRUE THEN
    DELETE FROM public.team_feed_posts
    WHERE dedupe_key = 'squad_feed:' || p_match_id::text;
    RETURN v_result;
  END IF;

  UPDATE public.team_feed_posts
  SET caption = coalesce(v_caption, caption),
      media_url = v_media,
      payload = CASE
        WHEN v_media IS NULL THEN coalesce(payload, '{}'::jsonb) - 'custom_auto_media_url'
        ELSE coalesce(payload, '{}'::jsonb) || jsonb_build_object('custom_auto_media_url', v_media)
      END,
      updated_at = now()
  WHERE dedupe_key = 'squad_feed:' || p_match_id::text;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_match_squad(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_match_squad(uuid, text, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
