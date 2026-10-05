-- Keep exported Once analyses separate from ordinary tagged scene clips.
ALTER TABLE public.match_videos DROP CONSTRAINT match_videos_category_check;
ALTER TABLE public.match_videos ADD CONSTRAINT match_videos_category_check
  CHECK (category IN ('highlights','goals','chances','defence','player','scenes','analysis'));

CREATE OR REPLACE FUNCTION public.update_match_video_details(
  p_video_id uuid, p_title text, p_category text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.match_videos%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.match_videos WHERE id = p_video_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_match_video(v.match_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Video' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Bitte einen Titel mit maximal 120 Zeichen eingeben';
  END IF;
  IF v.category = 'scenes'
    OR (v.category = 'analysis' AND p_category <> 'analysis')
    OR (v.category <> 'analysis' AND p_category NOT IN ('highlights','goals','chances','defence','player'))
    OR p_category IS NULL THEN
    RAISE EXCEPTION 'Ungültige Kategorie';
  END IF;
  UPDATE public.match_videos SET title = trim(p_title), category = p_category WHERE id = v.id;
  UPDATE public.team_feed_posts
    SET payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('category', p_category)
    WHERE dedupe_key = 'match_video:' || v.id::text AND post_kind = 'match_video';
END;
$$;
REVOKE ALL ON FUNCTION public.update_match_video_details(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_match_video_details(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_match_analysis_scene(
  p_video_id uuid, p_title text, p_scene_type text,
  p_scene_minute integer, p_analysis_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.match_videos%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.match_videos WHERE id = p_video_id FOR UPDATE;
  IF NOT FOUND OR v.category NOT IN ('scenes','analysis') OR NOT public.can_manage_match_video(v.match_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Spielszene' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 120
    OR p_scene_type NOT IN ('goal','shot','save','corner','defence','other')
    OR (p_scene_minute IS NOT NULL AND p_scene_minute NOT BETWEEN 0 AND 200)
    OR length(coalesce(p_analysis_note, '')) > 1000 THEN
    RAISE EXCEPTION 'Ungültige Angaben zur Spielszene';
  END IF;
  UPDATE public.match_videos
    SET title = trim(p_title), scene_type = p_scene_type,
        scene_minute = p_scene_minute, analysis_note = nullif(trim(coalesce(p_analysis_note, '')), '')
    WHERE id = v.id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_match_analysis_scene(uuid,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_match_analysis_scene(uuid,text,text,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.change_match_video_chapter(
  p_video_id uuid, p_action text, p_chapter_id uuid,
  p_second integer, p_kind text, p_title text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.match_videos%ROWTYPE;
  next_chapters jsonb;
  new_id uuid;
BEGIN
  SELECT * INTO v FROM public.match_videos WHERE id = p_video_id FOR UPDATE;
  IF NOT FOUND OR v.category IN ('analysis', 'scenes') OR NOT public.can_manage_match_video(v.match_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Spielvideo' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'add' THEN
    IF p_second IS NULL OR p_second NOT BETWEEN 0 AND 3600
      OR p_kind IS NULL OR p_kind NOT IN ('goal','shot','save','corner','defence','other')
      OR length(trim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 80
      OR jsonb_array_length(v.chapters) >= 100 THEN
      RAISE EXCEPTION 'Ungültige Zeitmarke';
    END IF;
    new_id := gen_random_uuid();
    next_chapters := v.chapters || jsonb_build_array(
      jsonb_build_object('id', new_id, 'second', p_second, 'kind', p_kind, 'title', trim(p_title))
    );
  ELSIF p_action = 'delete' AND p_chapter_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(chapter), '[]'::jsonb)
      INTO next_chapters
      FROM jsonb_array_elements(v.chapters) AS chapter
      WHERE chapter->>'id' <> p_chapter_id::text;
  ELSE
    RAISE EXCEPTION 'Ungültige Aktion';
  END IF;
  UPDATE public.match_videos SET chapters = next_chapters WHERE id = v.id;
  RETURN next_chapters;
END;
$$;

REVOKE ALL ON FUNCTION public.change_match_video_chapter(uuid,text,uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_match_video_chapter(uuid,text,uuid,integer,text,text) TO authenticated;
SELECT pg_notify('pgrst', 'reload schema');
