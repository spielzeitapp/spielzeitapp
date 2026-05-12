-- team_feed_posts: Staff/Admin darf Beiträge der jeweiligen Saison löschen.
-- Nutzt dieselbe SECURITY DEFINER-Logik wie INSERT (can_insert_team_feed_post = Staff-Mitgliedschaft + is_admin).
-- Storage-Löschung bleibt clientseitig; DELETE auf storage.objects ist bereits über team_feed_storage_staff_may_access_path geregelt.

GRANT DELETE ON public.team_feed_posts TO authenticated;

DROP POLICY IF EXISTS "team_feed_posts_delete_staff" ON public.team_feed_posts;
CREATE POLICY "team_feed_posts_delete_staff"
  ON public.team_feed_posts
  FOR DELETE
  TO authenticated
  USING (public.can_insert_team_feed_post(team_feed_posts.team_season_id));

COMMENT ON POLICY "team_feed_posts_delete_staff" ON public.team_feed_posts IS
  'Trainer/Co-Trainer/Head Coach für team_season_id oder System-Admin (can_insert_team_feed_post).';

SELECT pg_notify('pgrst', 'reload schema');
