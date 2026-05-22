-- team_feed_posts DELETE: dedizierte Staff-Prüfung + RLS-Policy + RPC nutzt can_delete_team_feed_post.
-- System-Admin über profiles.is_admin(); Team-Staff über memberships (trainer, co_trainer, head_coach).

CREATE OR REPLACE FUNCTION public.can_delete_team_feed_post(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = p_team_season_id
        AND m.role IN (
          'trainer'::public.membership_role,
          'co_trainer'::public.membership_role,
          'head_coach'::public.membership_role
        )
    );
$$;

COMMENT ON FUNCTION public.can_delete_team_feed_post(uuid) IS
  'True if auth.uid() may DELETE team_feed_posts for p_team_season_id (staff membership or system admin via is_admin).';

REVOKE ALL ON FUNCTION public.can_delete_team_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_team_feed_post(uuid) TO authenticated;

GRANT DELETE ON public.team_feed_posts TO authenticated;

DROP POLICY IF EXISTS "team_feed_posts_delete_staff" ON public.team_feed_posts;
DROP POLICY IF EXISTS "team staff can delete feed posts" ON public.team_feed_posts;

CREATE POLICY "team staff can delete feed posts"
  ON public.team_feed_posts
  FOR DELETE
  TO authenticated
  USING (public.can_delete_team_feed_post(team_season_id));

COMMENT ON POLICY "team staff can delete feed posts" ON public.team_feed_posts IS
  'Trainer/Co-Trainer/Head Coach für team_season_id oder System-Admin (can_delete_team_feed_post).';

-- RPC v1 (Legacy-Name): gleiche Berechtigung
CREATE OR REPLACE FUNCTION public.delete_team_feed_post(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id INTO v_ts
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'already_gone');
  END IF;

  RETURN json_build_object('ok', true, 'deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_team_feed_post_v2(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts uuid;
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT t.team_season_id INTO v_ts
  FROM public.team_feed_posts t
  WHERE t.id = p_post_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  END IF;

  IF NOT public.can_delete_team_feed_post(v_ts) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.team_feed_posts WHERE id = p_post_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', false, 'reason', 'already_gone');
  END IF;

  RETURN json_build_object('ok', true, 'deleted', true);
END;
$$;

COMMENT ON FUNCTION public.delete_team_feed_post_v2(uuid) IS
  'Löscht team_feed_posts.id = p_post_id wenn can_delete_team_feed_post(team_season_id). Idempotent: not_found / already_gone.';

REVOKE ALL ON FUNCTION public.delete_team_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_team_feed_post(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_team_feed_post_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_team_feed_post_v2(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
