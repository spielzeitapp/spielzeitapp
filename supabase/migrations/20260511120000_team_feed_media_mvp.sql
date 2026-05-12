-- MVP: Medien-Spalten für Team-Feed, optionales event_id (Trainer-Posts ohne Termin),
-- Storage-Bucket team-feed mit Pfaden images/{team_season_id}/… und videos/{team_season_id}/…

-- ---------------------------------------------------------------------------
-- team_feed_posts: Medien + nullable event_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_feed_posts
  ADD COLUMN IF NOT EXISTS media_type text NULL,
  ADD COLUMN IF NOT EXISTS media_url text NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_url text NULL,
  ADD COLUMN IF NOT EXISTS duration_seconds integer NULL;

COMMENT ON COLUMN public.team_feed_posts.media_type IS 'image | video | matchday | result (UI/MVP)';
COMMENT ON COLUMN public.team_feed_posts.media_url IS 'Öffentliche Storage-URL oder extern';
COMMENT ON COLUMN public.team_feed_posts.thumbnail_url IS 'Optional Vorschaubild (Video)';

ALTER TABLE public.team_feed_posts
  ALTER COLUMN event_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- INSERT für Staff (user_roles) + Mitgliedschaft in team_season
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "team_feed_posts_insert_staff" ON public.team_feed_posts;
CREATE POLICY "team_feed_posts_insert_staff"
  ON public.team_feed_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
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

GRANT INSERT ON public.team_feed_posts TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: Bucket team-feed (öffentlicher Lesezugriff für URLs in der App)
-- Pfad: images/<team_season_id>/…  oder  videos/<team_season_id>/…
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-feed',
  'team-feed',
  true,
  524288000,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bestehende Policies am Bucket nicht blind löschen: nur unsere ersetzen
DROP POLICY IF EXISTS "team_feed_storage_read_public" ON storage.objects;
CREATE POLICY "team_feed_storage_read_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'team-feed');

DROP POLICY IF EXISTS "team_feed_storage_insert_staff" ON storage.objects;
CREATE POLICY "team_feed_storage_insert_staff"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-feed'
    AND split_part(name, '/', 1) IN ('images', 'videos')
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id::text = split_part(storage.objects.name, '/', 2)
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.role)) IN ('admin', 'head_coach', 'trainer', 'co_trainer')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
