-- Trainingsbibliothek: Vereinsfreigabe (visibility) + Storage-Pfade unter exercises/{id}/.
-- Idempotent. Legacy-Pfade club_id/imports/... bleiben lesbar/löschbar.
-- NICHT auf Production anwenden, bevor Staging verifiziert ist.

ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS visibility text;

UPDATE public.training_exercises
SET visibility = 'club'
WHERE visibility IS NULL;

ALTER TABLE public.training_exercises
  ALTER COLUMN visibility SET DEFAULT 'club';

ALTER TABLE public.training_exercises
  ALTER COLUMN visibility SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'training_exercises_visibility_ok'
      AND conrelid = 'public.training_exercises'::regclass
  ) THEN
    ALTER TABLE public.training_exercises
      ADD CONSTRAINT training_exercises_visibility_ok
      CHECK (visibility IN ('club', 'private'));
  END IF;
END $$;

COMMENT ON COLUMN public.training_exercises.visibility IS
  'club = für Vereinstrainer sichtbar; private = nur Ersteller (created_by).';

CREATE INDEX IF NOT EXISTS idx_training_exercises_club_visibility
  ON public.training_exercises (club_id, visibility)
  WHERE is_active;

DROP POLICY IF EXISTS training_exercises_select ON public.training_exercises;
CREATE POLICY training_exercises_select ON public.training_exercises
  FOR SELECT TO authenticated
  USING (
    public.can_manage_club_venues(club_id)
    AND (
      visibility = 'club'
      OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS training_exercises_insert ON public.training_exercises;
CREATE POLICY training_exercises_insert ON public.training_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_club_venues(club_id)
    AND visibility IN ('club', 'private')
    AND (
      visibility = 'club'
      OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS training_exercises_update ON public.training_exercises;
CREATE POLICY training_exercises_update ON public.training_exercises
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_club_venues(club_id)
    AND (
      visibility = 'club'
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.can_manage_club_venues(club_id)
    AND (
      visibility = 'club'
      OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS training_exercises_delete ON public.training_exercises;
CREATE POLICY training_exercises_delete ON public.training_exercises
  FOR DELETE TO authenticated
  USING (
    public.can_manage_club_venues(club_id)
    AND (
      visibility = 'club'
      OR created_by = auth.uid()
    )
  );

-- Storage: exercises/{exercise_id}/… zusätzlich zu Legacy imports/
DROP POLICY IF EXISTS "training_exercise_media_insert_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_insert_managers"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND split_part(name, '/', 2) IN ('imports', 'exercises')
    AND (
      split_part(name, '/', 2) = 'imports'
      OR split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    AND public.can_manage_club_venues(split_part(name, '/', 1)::uuid)
  );

SELECT pg_notify('pgrst', 'reload schema');
