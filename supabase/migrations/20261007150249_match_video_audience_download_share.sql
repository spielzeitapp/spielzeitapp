CREATE OR REPLACE FUNCTION public.can_read_match_video(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.match_videos v WHERE v.id=p_id AND (
 public.can_manage_match_video(v.match_id) OR
 (v.visibility='team' AND EXISTS (
 SELECT 1 FROM public.memberships m WHERE m.user_id=auth.uid()
 AND m.team_season_id=v.team_season_id AND m.role::text IN ('parent','player','fan')
 ))));
$$;
REVOKE ALL ON FUNCTION public.can_read_match_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_match_video(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.release_match_video(p_video_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.match_videos%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 SELECT * INTO v FROM public.match_videos WHERE id=p_video_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_match_video(v.match_id) THEN
 RAISE EXCEPTION 'Keine Berechtigung für dieses Video';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='match-videos' AND name=v.object_path) THEN
 RAISE EXCEPTION 'Videodatei noch nicht verfügbar';
 END IF;
 UPDATE public.match_videos SET visibility='team' WHERE id=v.id;
END;
$$;
REVOKE ALL ON FUNCTION public.release_match_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_match_video(uuid) TO authenticated;
COMMENT ON FUNCTION public.release_match_video(uuid) IS 'Trainer releases a stored match clip to parent/player/fan members of its season without adding a feed post.';
