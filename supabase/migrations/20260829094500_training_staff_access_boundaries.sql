-- TRAINING-ACCESS.1
-- Entkoppelt Trainingsrechte von der Platz-/Anlagenverwaltung.
-- Trainer verwalten Trainingsinhalte ihrer Mannschaft; Vereinsadmins ihren Verein.

CREATE OR REPLACE FUNCTION public.can_manage_training_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_club_id IS NOT NULL
    AND public.club_is_operable(p_club_id)
    AND (
      public.is_platform_admin()
      OR public.is_club_admin_for_club(p_club_id)
      OR EXISTS (
        SELECT 1
        FROM public.memberships m
        JOIN public.team_seasons ts ON ts.id = m.team_season_id
        JOIN public.teams t ON t.id = ts.team_id
        WHERE m.user_id = auth.uid()
          AND t.club_id = p_club_id
          AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_training_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_training_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_training_team_season(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_team_season_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_seasons target
      JOIN public.teams t ON t.id = target.team_id
      WHERE target.id = p_team_season_id
        AND public.club_is_operable(t.club_id)
        AND (
          public.is_platform_admin()
          OR public.is_club_admin_for_club(t.club_id)
          OR EXISTS (
            SELECT 1
            FROM public.memberships m
            WHERE m.user_id = auth.uid()
              AND m.team_season_id = target.id
              AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'head', 'admin')
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_training_team_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_training_team_season(uuid) TO authenticated;

-- Vereinsweite Übungsbibliothek: Staff sieht Vereinsübungen, private Übungen nur der Ersteller.
DROP POLICY IF EXISTS training_exercises_select ON public.training_exercises;
CREATE POLICY training_exercises_select ON public.training_exercises
  FOR SELECT TO authenticated
  USING (
    public.can_manage_training_club(club_id)
    AND (visibility = 'club' OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS training_exercises_insert ON public.training_exercises;
CREATE POLICY training_exercises_insert ON public.training_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_training_club(club_id)
    AND visibility IN ('club', 'private')
    AND (visibility = 'club' OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS training_exercises_update ON public.training_exercises;
CREATE POLICY training_exercises_update ON public.training_exercises
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_training_club(club_id)
    AND (visibility = 'club' OR created_by = auth.uid())
  )
  WITH CHECK (
    public.can_manage_training_club(club_id)
    AND (visibility = 'club' OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS training_exercises_delete ON public.training_exercises;
CREATE POLICY training_exercises_delete ON public.training_exercises
  FOR DELETE TO authenticated
  USING (
    public.can_manage_training_club(club_id)
    AND (visibility = 'club' OR created_by = auth.uid())
  );

-- Trainingseinheiten: Trainer nur in ihrer Mannschaftssaison; Vereins-/Plattformadmin im Verein.
DROP POLICY IF EXISTS training_sessions_select ON public.training_sessions;
CREATE POLICY training_sessions_select ON public.training_sessions
  FOR SELECT TO authenticated
  USING (public.can_manage_training_team_season(team_season_id));

DROP POLICY IF EXISTS training_sessions_insert ON public.training_sessions;
CREATE POLICY training_sessions_insert ON public.training_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_training_team_season(team_season_id)
    AND EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = training_sessions.team_season_id
        AND t.id = training_sessions.team_id
        AND t.club_id = training_sessions.club_id
    )
  );

DROP POLICY IF EXISTS training_sessions_update ON public.training_sessions;
CREATE POLICY training_sessions_update ON public.training_sessions
  FOR UPDATE TO authenticated
  USING (public.can_manage_training_team_season(team_season_id))
  WITH CHECK (
    public.can_manage_training_team_season(team_season_id)
    AND EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = training_sessions.team_season_id
        AND t.id = training_sessions.team_id
        AND t.club_id = training_sessions.club_id
    )
  );

DROP POLICY IF EXISTS training_sessions_delete ON public.training_sessions;
CREATE POLICY training_sessions_delete ON public.training_sessions
  FOR DELETE TO authenticated
  USING (public.can_manage_training_team_season(team_season_id));

DROP POLICY IF EXISTS training_session_exercises_select ON public.training_session_exercises;
CREATE POLICY training_session_exercises_select ON public.training_session_exercises
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.training_sessions s
    WHERE s.id = training_session_exercises.training_session_id
      AND public.can_manage_training_team_season(s.team_season_id)
  ));

DROP POLICY IF EXISTS training_session_exercises_insert ON public.training_session_exercises;
CREATE POLICY training_session_exercises_insert ON public.training_session_exercises
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.training_sessions s
    WHERE s.id = training_session_exercises.training_session_id
      AND public.can_manage_training_team_season(s.team_season_id)
  ));

DROP POLICY IF EXISTS training_session_exercises_update ON public.training_session_exercises;
CREATE POLICY training_session_exercises_update ON public.training_session_exercises
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.training_sessions s
    WHERE s.id = training_session_exercises.training_session_id
      AND public.can_manage_training_team_season(s.team_season_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.training_sessions s
    WHERE s.id = training_session_exercises.training_session_id
      AND public.can_manage_training_team_season(s.team_season_id)
  ));

DROP POLICY IF EXISTS training_session_exercises_delete ON public.training_session_exercises;
CREATE POLICY training_session_exercises_delete ON public.training_session_exercises
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.training_sessions s
    WHERE s.id = training_session_exercises.training_session_id
      AND public.can_manage_training_team_season(s.team_season_id)
  ));

-- Trainerprüfungs-Dokumentation bleibt persönlich, nutzt aber Trainings- statt Platzrechte.
DROP POLICY IF EXISTS training_exam_documentations_select ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_select ON public.training_exam_documentations
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    AND public.can_manage_training_team_season(team_season_id)
  );

DROP POLICY IF EXISTS training_exam_documentations_insert ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_insert ON public.training_exam_documentations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_manage_training_team_season(team_season_id)
    AND EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = training_exam_documentations.team_season_id
        AND t.club_id = training_exam_documentations.club_id
    )
  );

DROP POLICY IF EXISTS training_exam_documentations_update ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_update ON public.training_exam_documentations
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.can_manage_training_team_season(team_season_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_manage_training_team_season(team_season_id)
    AND EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = training_exam_documentations.team_season_id
        AND t.club_id = training_exam_documentations.club_id
    )
  );

DROP POLICY IF EXISTS training_exam_documentations_delete ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_delete ON public.training_exam_documentations
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.can_manage_training_team_season(team_season_id)
  );

DROP POLICY IF EXISTS training_exam_documentation_items_select ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_select ON public.training_exam_documentation_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = training_exam_documentation_items.documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_training_team_season(d.team_season_id)
  ));

DROP POLICY IF EXISTS training_exam_documentation_items_insert ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_insert ON public.training_exam_documentation_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = training_exam_documentation_items.documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_training_team_season(d.team_season_id)
  ));

DROP POLICY IF EXISTS training_exam_documentation_items_update ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_update ON public.training_exam_documentation_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = training_exam_documentation_items.documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_training_team_season(d.team_season_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = training_exam_documentation_items.documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_training_team_season(d.team_season_id)
  ));

DROP POLICY IF EXISTS training_exam_documentation_items_delete ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_delete ON public.training_exam_documentation_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = training_exam_documentation_items.documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_training_team_season(d.team_season_id)
  ));

-- Privater Skizzen-Bucket: dieselben Trainingsrechte wie die Bibliothek.
DROP POLICY IF EXISTS "training_exercise_media_select_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_select_managers"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.can_manage_training_club(split_part(name, '/', 1)::uuid)
  );

DROP POLICY IF EXISTS "training_exercise_media_insert_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_insert_managers"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND split_part(name, '/', 2) IN ('imports', 'exercises')
    AND public.can_manage_training_club(split_part(name, '/', 1)::uuid)
  );

DROP POLICY IF EXISTS "training_exercise_media_delete_managers" ON storage.objects;
CREATE POLICY "training_exercise_media_delete_managers"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'training-exercise-media'
    AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.can_manage_training_club(split_part(name, '/', 1)::uuid)
  );

SELECT pg_notify('pgrst', 'reload schema');
