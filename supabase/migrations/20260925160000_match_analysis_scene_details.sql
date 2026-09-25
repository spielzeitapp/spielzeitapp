-- Optional metadata for exported analysis clips. Existing match videos remain unchanged.
ALTER TABLE public.match_videos
  ADD COLUMN IF NOT EXISTS scene_type text,
  ADD COLUMN IF NOT EXISTS scene_minute integer,
  ADD COLUMN IF NOT EXISTS analysis_note text;

ALTER TABLE public.match_videos
  ADD CONSTRAINT match_videos_scene_type_check
    CHECK (scene_type IS NULL OR scene_type IN ('goal', 'shot', 'save', 'corner', 'defence', 'other')),
  ADD CONSTRAINT match_videos_scene_minute_check
    CHECK (scene_minute IS NULL OR scene_minute BETWEEN 0 AND 200),
  ADD CONSTRAINT match_videos_analysis_note_check
    CHECK (analysis_note IS NULL OR length(analysis_note) <= 1000);

-- Match video rows are inserted by authorized staff only (existing INSERT policy).
-- Edits stay behind a dedicated staff-only RPC instead of granting direct UPDATE.
CREATE OR REPLACE FUNCTION public.update_match_analysis_scene(
  p_video_id uuid, p_title text, p_scene_type text,
  p_scene_minute integer, p_analysis_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.match_videos%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.match_videos WHERE id = p_video_id FOR UPDATE;
  IF NOT FOUND OR v.category <> 'analysis' OR NOT public.can_manage_match_video(v.match_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Spielanalyse' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 120
    OR p_scene_type NOT IN ('goal', 'shot', 'save', 'corner', 'defence', 'other')
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

SELECT pg_notify('pgrst', 'reload schema');
