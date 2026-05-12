-- team_feed_posts INSERT: Staff-Prüfung über SECURITY DEFINER, damit die Policy nicht an
-- memberships-RLS scheitert (EXISTS-Subquery läuft sonst als Invoker → Zeile unsichtbar → RLS verweigert).
-- Zusätzlich: System-Admins (profiles.is_admin / is_admin()) dürfen posten ohne Trainer-Mitgliedschaft.

CREATE OR REPLACE FUNCTION public.can_insert_team_feed_post(p_team_season_id uuid)
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

COMMENT ON FUNCTION public.can_insert_team_feed_post(uuid) IS
  'True if auth.uid() may INSERT team_feed_posts for p_team_season_id (staff membership or system admin). SECURITY DEFINER avoids memberships RLS hiding rows from INSERT policy.';

REVOKE ALL ON FUNCTION public.can_insert_team_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_insert_team_feed_post(uuid) TO authenticated;

DROP POLICY IF EXISTS "team_feed_posts_insert_staff" ON public.team_feed_posts;

CREATE POLICY "team_feed_posts_insert_staff"
  ON public.team_feed_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (team_feed_posts.created_by IS NULL OR team_feed_posts.created_by = auth.uid())
    AND public.can_insert_team_feed_post(team_feed_posts.team_season_id)
  );

SELECT pg_notify('pgrst', 'reload schema');
