-- Team-Feed Storage: Upload scheiterte mit 400, weil INSERT auf storage.objects
-- zusätzlich user_roles verlangte — Trainer/Co nur über memberships hatten keine Zeile in user_roles.
-- Lösung: SECURITY DEFINER-Hilfsfunktion prüft memberships.role (trainer/co_trainer/head_coach) + is_admin(),
-- Pfad: team-feed / images|videos|thumbnails / <team_season_id> / …

CREATE OR REPLACE FUNCTION public.team_feed_storage_staff_may_access_path(p_bucket_id text, p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_bucket_id = 'team-feed'
    AND split_part(p_name, '/', 1) IN ('images', 'videos', 'thumbnails')
    AND length(trim(split_part(p_name, '/', 2))) > 0
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.user_id = auth.uid()
          AND m.team_season_id::text = split_part(p_name, '/', 2)
          AND m.role IN (
            'trainer'::public.membership_role,
            'co_trainer'::public.membership_role,
            'head_coach'::public.membership_role
          )
      )
    );
$$;

COMMENT ON FUNCTION public.team_feed_storage_staff_may_access_path(text, text) IS
  'True if auth.uid() may staff-write team-feed object at path p_name (bucket + images|videos|thumbnails + team_season segment). SECURITY DEFINER reads memberships without RLS hiding rows.';

REVOKE ALL ON FUNCTION public.team_feed_storage_staff_may_access_path(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_feed_storage_staff_may_access_path(text, text) TO authenticated;

DROP POLICY IF EXISTS "team_feed_storage_insert_staff" ON storage.objects;
CREATE POLICY "team_feed_storage_insert_staff"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.team_feed_storage_staff_may_access_path(bucket_id, name));

DROP POLICY IF EXISTS "team_feed_storage_update_owner_or_staff" ON storage.objects;
CREATE POLICY "team_feed_storage_update_owner_or_staff"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'team-feed'
    AND (
      (owner_id IS NOT NULL AND owner_id = auth.uid()::text)
      OR public.team_feed_storage_staff_may_access_path(bucket_id, name)
    )
  )
  WITH CHECK (bucket_id = 'team-feed');

DROP POLICY IF EXISTS "team_feed_storage_delete_owner_or_staff" ON storage.objects;
CREATE POLICY "team_feed_storage_delete_owner_or_staff"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'team-feed'
    AND (
      (owner_id IS NOT NULL AND owner_id = auth.uid()::text)
      OR public.team_feed_storage_staff_may_access_path(bucket_id, name)
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
