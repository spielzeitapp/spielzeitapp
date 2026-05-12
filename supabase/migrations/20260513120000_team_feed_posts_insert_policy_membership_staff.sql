-- team_feed_posts INSERT: Staff auch über memberships.role (nicht nur user_roles).
-- Hintergrund: Trainer/Co/Chef sind oft nur in memberships eingetragen; user_roles fehlt → RLS blockierte INSERT.

DROP POLICY IF EXISTS "team_feed_posts_insert_staff" ON public.team_feed_posts;

CREATE POLICY "team_feed_posts_insert_staff"
  ON public.team_feed_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.team_season_id = team_feed_posts.team_season_id
        AND m.user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND lower(trim(ur.role)) IN ('admin', 'head_coach', 'trainer', 'co_trainer')
      )
      OR EXISTS (
        SELECT 1
        FROM public.memberships m2
        WHERE m2.team_season_id = team_feed_posts.team_season_id
          AND m2.user_id = auth.uid()
          AND lower(trim(m2.role::text)) IN (
            'admin',
            'trainer',
            'head_coach',
            'head',
            'headcoach',
            'co_trainer',
            'co-trainer',
            'co trainer',
            'assistant'
          )
      )
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
