-- Feed-Medien finalisieren: created_by, updated_at, privater team-feed-Bucket,
-- Storage-RLS (Lesen nur Team-Mitglieder, Upload/Delete Staff bzw. Owner).

-- ---------------------------------------------------------------------------
-- team_feed_posts: Ersteller + Zeitstempel
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_feed_posts
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.team_feed_posts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.team_feed_posts
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.team_feed_posts
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

COMMENT ON COLUMN public.team_feed_posts.created_by IS 'auth.users: Staff-Upload; NULL bei Auto-Matchday (RPC).';
COMMENT ON COLUMN public.team_feed_posts.updated_at IS 'Letzte Änderung (Trigger set_updated_at).';
COMMENT ON COLUMN public.team_feed_posts.media_url IS 'Konsistent: Objektpfad im Bucket team-feed, z. B. images/<team_season_id>/<uuid>.jpg — alternativ Legacy volle https-URL.';

DROP TRIGGER IF EXISTS trg_team_feed_posts_updated_at ON public.team_feed_posts;
CREATE TRIGGER trg_team_feed_posts_updated_at
  BEFORE UPDATE ON public.team_feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Staff-Insert: Ersteller muss gesetzt sein (Client-Uploads); RPC umgeht RLS.
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
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.role)) IN ('admin', 'head_coach', 'trainer', 'co_trainer')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: team-feed privat, Mitglied-Lesen, Staff-Upload, Owner/Staff Delete+Update
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 157286400,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
WHERE id = 'team-feed';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'team-feed',
  'team-feed',
  false,
  157286400,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'team-feed');

DROP POLICY IF EXISTS "team_feed_storage_read_public" ON storage.objects;
DROP POLICY IF EXISTS "team_feed_storage_select_members" ON storage.objects;
CREATE POLICY "team_feed_storage_select_members"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'team-feed'
    AND split_part(name, '/', 1) IN ('images', 'videos', 'thumbnails')
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id::text = split_part(name, '/', 2)
    )
  );

DROP POLICY IF EXISTS "team_feed_storage_insert_staff" ON storage.objects;
CREATE POLICY "team_feed_storage_insert_staff"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-feed'
    AND split_part(name, '/', 1) IN ('images', 'videos', 'thumbnails')
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id::text = split_part(name, '/', 2)
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.role)) IN ('admin', 'head_coach', 'trainer', 'co_trainer')
    )
  );

DROP POLICY IF EXISTS "team_feed_storage_update_owner_or_staff" ON storage.objects;
CREATE POLICY "team_feed_storage_update_owner_or_staff"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'team-feed'
    AND (
      (owner_id IS NOT NULL AND owner_id = auth.uid()::text)
      OR (
        EXISTS (
          SELECT 1
          FROM public.memberships m
          WHERE m.user_id = auth.uid()
            AND m.team_season_id::text = split_part(name, '/', 2)
        )
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND lower(trim(ur.role)) IN ('admin', 'head_coach', 'trainer', 'co_trainer')
        )
      )
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
      OR (
        EXISTS (
          SELECT 1
          FROM public.memberships m
          WHERE m.user_id = auth.uid()
            AND m.team_season_id::text = split_part(name, '/', 2)
        )
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND lower(trim(ur.role)) IN ('admin', 'head_coach', 'trainer', 'co_trainer')
        )
      )
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
