-- Match-Videos: original file stays private. A feed post is only a reference to it.
-- Apply to staging before testing the UI; never use the existing team-feed bucket
-- for unshared U12 clips (its policies allow every season member to read it).

CREATE TABLE IF NOT EXISTS public.match_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'highlights'
    CHECK (category IN ('highlights', 'goals', 'chances', 'defence', 'player')),
  visibility text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff', 'team')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_videos_path CHECK (
    object_path ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(mp4|mov|webm)$'
    AND split_part(object_path, '/', 1) = team_season_id::text
    AND split_part(object_path, '/', 2) = match_id::text
    AND split_part(split_part(object_path, '/', 3), '.', 1) = id::text
  )
);
CREATE INDEX IF NOT EXISTS match_videos_match_created_idx
  ON public.match_videos(match_id, created_at DESC);
ALTER TABLE public.match_videos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_match_video(p_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.matches ma JOIN public.memberships me
      ON me.team_season_id = ma.team_season_id
    WHERE ma.id = p_match_id AND me.user_id = auth.uid()
      AND me.role IN ('trainer'::public.membership_role,
                      'co_trainer'::public.membership_role,
                      'head_coach'::public.membership_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_match_video(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_videos v
    WHERE v.id = p_id AND (
      public.can_manage_match_video(v.match_id)
      OR (v.visibility = 'team' AND EXISTS (
        SELECT 1 FROM public.memberships me
        WHERE me.team_season_id = v.team_season_id AND me.user_id = auth.uid()
          AND me.role IN ('parent'::public.membership_role,
                          'player'::public.membership_role)
      ))
    )
  );
$$;

CREATE POLICY match_videos_select ON public.match_videos FOR SELECT TO authenticated
  USING (public.can_read_match_video(id));
CREATE POLICY match_videos_insert ON public.match_videos FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_match_video(match_id)
    AND EXISTS (SELECT 1 FROM public.matches ma
                WHERE ma.id = match_id AND ma.team_season_id = match_videos.team_season_id)
    AND visibility = 'staff' AND created_by = auth.uid()
  );
CREATE POLICY match_videos_delete ON public.match_videos FOR DELETE TO authenticated
  USING (public.can_manage_match_video(match_id) AND visibility = 'staff');
GRANT SELECT, INSERT, DELETE ON public.match_videos TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('match-videos', 'match-videos', false, 157286400,
        ARRAY['video/mp4','video/quicktime','video/webm']::text[])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 157286400,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_upload_match_video_path(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches ma
    WHERE ma.id::text = split_part(p_name, '/', 2)
      AND ma.team_season_id::text = split_part(p_name, '/', 1)
      AND p_name ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(mp4|mov|webm)$'
      AND public.can_manage_match_video(ma.id)
  );
$$;
CREATE OR REPLACE FUNCTION public.can_read_match_video_path(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_videos v
    WHERE v.object_path = p_name AND public.can_read_match_video(v.id)
  );
$$;

CREATE POLICY match_videos_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-videos' AND public.can_upload_match_video_path(name));
CREATE POLICY match_videos_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'match-videos' AND public.can_read_match_video_path(name));
CREATE POLICY match_videos_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'match-videos' AND public.can_upload_match_video_path(name));

-- Atomic publication/revocation: never leak staff-only material via the feed.
CREATE OR REPLACE FUNCTION public.publish_match_video(p_video_id uuid, p_caption text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.match_videos%ROWTYPE; v_team_id uuid; v_post_id uuid;
BEGIN
  SELECT * INTO v FROM public.match_videos WHERE id = p_video_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_match_video(v.match_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Video';
  END IF;
  SELECT team_id INTO v_team_id FROM public.team_seasons WHERE id = v.team_season_id;
  UPDATE public.match_videos SET visibility = 'team' WHERE id = v.id;
  INSERT INTO public.team_feed_posts
    (team_season_id, team_id, event_id, post_kind, caption, payload, dedupe_key,
     media_type, media_url, created_by)
  VALUES
    (v.team_season_id, v_team_id, NULL, 'match_video',
     left(coalesce(nullif(trim(p_caption), ''), v.title), 500),
     jsonb_build_object('match_id', v.match_id, 'video_id', v.id, 'category', v.category),
     'match_video:' || v.id::text, 'video', 'match-videos/' || v.object_path, auth.uid())
  ON CONFLICT (dedupe_key) DO UPDATE SET caption = EXCLUDED.caption
  RETURNING id INTO v_post_id;
  RETURN v_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpublish_match_video(p_video_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.match_videos%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.match_videos WHERE id = p_video_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_match_video(v.match_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Video';
  END IF;
  DELETE FROM public.team_feed_posts WHERE dedupe_key = 'match_video:' || v.id::text;
  UPDATE public.match_videos SET visibility = 'staff' WHERE id = v.id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_match_video(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_match_video(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_match_video(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_match_video(uuid) TO authenticated;

-- Deleting the post through the existing feed controls also withdraws access.
CREATE OR REPLACE FUNCTION public.withdraw_match_video_on_feed_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.post_kind = 'match_video' THEN
    UPDATE public.match_videos SET visibility = 'staff'
    WHERE id::text = split_part(OLD.dedupe_key, ':', 2);
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER withdraw_match_video_on_feed_delete
AFTER DELETE ON public.team_feed_posts FOR EACH ROW
EXECUTE FUNCTION public.withdraw_match_video_on_feed_delete();

-- Existing feed policy must not reveal the new youth video post to fan memberships.
DROP POLICY IF EXISTS "team_feed_posts_select_members" ON public.team_feed_posts;
CREATE POLICY "team_feed_posts_select_members" ON public.team_feed_posts
FOR SELECT TO authenticated USING (
  CASE WHEN post_kind = 'match_video' THEN
    EXISTS (SELECT 1 FROM public.match_videos v
            WHERE v.id::text = split_part(dedupe_key, ':', 2)
              AND public.can_read_match_video(v.id))
  ELSE public.is_admin() OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.team_seasons ts_mem ON ts_mem.id = m.team_season_id
    WHERE m.user_id = auth.uid() AND ts_mem.team_id = team_feed_posts.team_id
  ) END
);

SELECT pg_notify('pgrst', 'reload schema');
