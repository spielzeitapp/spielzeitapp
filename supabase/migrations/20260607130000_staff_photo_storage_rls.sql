-- Staff trainer avatars in storage bucket team-photos.
-- Path: {team_season_id}/staff/{user_id}.{ext}
-- Uses can_manage_team_staff (SECURITY DEFINER) so memberships RLS does not block uploads.

CREATE OR REPLACE FUNCTION public.staff_photo_storage_may_access_path(p_bucket_id text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_season_id uuid;
BEGIN
  IF p_bucket_id IS DISTINCT FROM 'team-photos' THEN
    RETURN false;
  END IF;

  IF split_part(p_name, '/', 2) IS DISTINCT FROM 'staff' THEN
    RETURN false;
  END IF;

  IF length(trim(split_part(p_name, '/', 1))) = 0 THEN
    RETURN false;
  END IF;

  BEGIN
    v_team_season_id := split_part(p_name, '/', 1)::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  RETURN public.can_manage_team_staff(v_team_season_id);
END;
$$;

COMMENT ON FUNCTION public.staff_photo_storage_may_access_path(text, text) IS
  'True if auth.uid() may read/write team-photos objects at {team_season_id}/staff/* (admin or can_manage_team_staff).';

REVOKE ALL ON FUNCTION public.staff_photo_storage_may_access_path(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_photo_storage_may_access_path(text, text) TO authenticated;

DROP POLICY IF EXISTS "team_photos_staff_photo_select" ON storage.objects;
CREATE POLICY "team_photos_staff_photo_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (public.staff_photo_storage_may_access_path(bucket_id, name));

DROP POLICY IF EXISTS "team_photos_staff_photo_insert" ON storage.objects;
CREATE POLICY "team_photos_staff_photo_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.staff_photo_storage_may_access_path(bucket_id, name));

DROP POLICY IF EXISTS "team_photos_staff_photo_update" ON storage.objects;
CREATE POLICY "team_photos_staff_photo_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (public.staff_photo_storage_may_access_path(bucket_id, name))
  WITH CHECK (public.staff_photo_storage_may_access_path(bucket_id, name));

DROP POLICY IF EXISTS "team_photos_staff_photo_delete" ON storage.objects;
CREATE POLICY "team_photos_staff_photo_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (public.staff_photo_storage_may_access_path(bucket_id, name));

SELECT pg_notify('pgrst', 'reload schema');
