-- MVP: team_feed_posts INSERT nur über Staff-Mitgliedschaft (memberships.role als ENUM → ::text).
-- Entfernt Abhängigkeit von user_roles für INSERT (war häufige Ursache für RLS-Blockaden).
-- created_by: Default auth.uid(), zusätzlich WITH CHECK damit kein Fremd-User gesetzt werden kann.

ALTER TABLE public.team_feed_posts
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "team_feed_posts_insert_staff" ON public.team_feed_posts;

CREATE POLICY "team_feed_posts_insert_staff"
  ON public.team_feed_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (team_feed_posts.created_by IS NULL OR team_feed_posts.created_by = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = team_feed_posts.team_season_id
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  );

-- Welche Policy in Produktion für INSERT auf team_feed_posts aktiv ist:
-- SELECT pol.polname, pol.polcmd, pol.polroles::regrole[],
--        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
-- FROM pg_policy pol
-- JOIN pg_class c ON c.oid = pol.polrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relname = 'team_feed_posts' AND pol.polcmd = 'a';

SELECT pg_notify('pgrst', 'reload schema');
