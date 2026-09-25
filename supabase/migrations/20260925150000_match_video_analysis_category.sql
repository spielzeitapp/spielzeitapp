-- Prepare a separate, staff-only collection of exported analysis scenes.
-- Existing highlights and published feed posts retain their current category.
ALTER TABLE public.match_videos
  DROP CONSTRAINT IF EXISTS match_videos_category_check;
ALTER TABLE public.match_videos
  ADD CONSTRAINT match_videos_category_check
  CHECK (category IN ('highlights', 'goals', 'chances', 'defence', 'player', 'analysis'));

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
  IF p_category IS NULL OR p_category NOT IN ('highlights', 'goals', 'chances', 'defence', 'player', 'analysis') THEN
    RAISE EXCEPTION 'Ungültige Kategorie';
  END IF;
  UPDATE public.match_videos
    SET title = trim(p_title), category = p_category WHERE id = v.id;
  UPDATE public.team_feed_posts
    SET payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('category', p_category)
    WHERE dedupe_key = 'match_video:' || v.id::text AND post_kind = 'match_video';
END;
$$;
REVOKE ALL ON FUNCTION public.update_match_video_details(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_match_video_details(uuid, text, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
