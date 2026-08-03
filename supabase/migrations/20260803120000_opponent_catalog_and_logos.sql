-- STEP 7B.4: Persistenter Gegner-Katalog (saisonübergreifende Logos) + Storage-Bucket.
-- Manuell auf Staging anwenden. Agent führt diese Migration NICHT aus.

CREATE TABLE IF NOT EXISTS public.opponent_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  opponent_key text NOT NULL,
  display_name text NOT NULL,
  logo_url text NULL,
  external_source text NULL,
  external_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opponent_catalog_key_nonempty CHECK (length(btrim(opponent_key)) > 0),
  CONSTRAINT opponent_catalog_club_key_unique UNIQUE (club_id, opponent_key)
);

CREATE INDEX IF NOT EXISTS idx_opponent_catalog_club_id
  ON public.opponent_catalog (club_id);

COMMENT ON TABLE public.opponent_catalog IS
  'Club-scoped opponent identity for reusable logos (and later metadata). Key = normalizeOpponentKey.';

ALTER TABLE public.opponent_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opponent_catalog_select ON public.opponent_catalog;
CREATE POLICY opponent_catalog_select
  ON public.opponent_catalog
  FOR SELECT
  TO authenticated
  USING (public.can_read_club_venues(club_id));

DROP POLICY IF EXISTS opponent_catalog_insert ON public.opponent_catalog;
CREATE POLICY opponent_catalog_insert
  ON public.opponent_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS opponent_catalog_update ON public.opponent_catalog;
CREATE POLICY opponent_catalog_update
  ON public.opponent_catalog
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS opponent_catalog_delete ON public.opponent_catalog;
CREATE POLICY opponent_catalog_delete
  ON public.opponent_catalog
  FOR DELETE
  TO authenticated
  USING (public.can_manage_club_venues(club_id));

-- Public logo files: path {clubId}/{opponentKey}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'opponent-logos',
  'opponent-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS opponent_logos_public_read ON storage.objects;
CREATE POLICY opponent_logos_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'opponent-logos');

DROP POLICY IF EXISTS opponent_logos_staff_insert ON storage.objects;
CREATE POLICY opponent_logos_staff_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'opponent-logos'
    AND public.can_manage_club_venues((split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS opponent_logos_staff_update ON storage.objects;
CREATE POLICY opponent_logos_staff_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'opponent-logos'
    AND public.can_manage_club_venues((split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'opponent-logos'
    AND public.can_manage_club_venues((split_part(name, '/', 1))::uuid)
  );

DROP POLICY IF EXISTS opponent_logos_staff_delete ON storage.objects;
CREATE POLICY opponent_logos_staff_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'opponent-logos'
    AND public.can_manage_club_venues((split_part(name, '/', 1))::uuid)
  );
