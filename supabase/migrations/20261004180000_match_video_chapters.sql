-- Chapter timestamps within exported highlight compilations. Staff maintain them;
-- existing match-video SELECT visibility also controls access to this metadata.
ALTER TABLE public.match_videos
  ADD COLUMN IF NOT EXISTS chapters jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.match_videos
  ADD CONSTRAINT match_videos_chapters_array_check CHECK (jsonb_typeof(chapters) = 'array');

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
  IF NOT FOUND OR v.category = 'analysis' OR NOT public.can_manage_match_video(v.match_id) THEN
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
