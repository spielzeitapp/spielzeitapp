-- IMPORT.1: Einzelübungs-PDF-Import für die bestehende Übungsbibliothek.
-- Additiv: Quellenangabe + privater Bucket für extrahierte Übungsskizzen.
-- Die Original-PDF wird nicht gespeichert.
-- NICHT auf Production anwenden, bevor Staging verifiziert ist.

ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS source_reference text;

COMMENT ON COLUMN public.training_exercises.source_reference IS
  'Freie Quellenangabe für importierte Übungen (Dokument, Datum, Autor).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-exercise-media',
  'training-exercise-media',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "training_exercise_media_select_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_select_managers"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.can_manage_club_venues(split_part(name, '/', 1)::uuid)
  );

DROP POLICY IF EXISTS "training_exercise_media_insert_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_insert_managers"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 2) = 'imports'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.can_manage_club_venues(split_part(name, '/', 1)::uuid)
  );

DROP POLICY IF EXISTS "training_exercise_media_delete_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_delete_managers"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.can_manage_club_venues(split_part(name, '/', 1)::uuid)
  );

SELECT pg_notify('pgrst', 'reload schema');
