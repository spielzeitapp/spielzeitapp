-- STEP 3A Manager: Übungsbibliothek + Trainingseinheiten (AW · HT1 · HT2 · AK).
-- Additive only. Events bleiben das Terminobjekt (kein zweiter Kalender).
-- NICHT auf Production anwenden, bevor Staging verifiziert ist.

-- ---------------------------------------------------------------------------
-- training_exercises
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  focus text NOT NULL DEFAULT 'technik',
  suitable_phases text[] NOT NULL DEFAULT ARRAY['HT1']::text[],
  age_group text,
  duration_minutes integer NOT NULL DEFAULT 15,
  player_count_min integer,
  player_count_max integer,
  difficulty text NOT NULL DEFAULT 'medium',
  materials text,
  organization text,
  coaching_points text,
  variations text,
  image_path text,
  source_type text NOT NULL DEFAULT 'club',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_exercises_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT training_exercises_duration_ok CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  CONSTRAINT training_exercises_players_ok CHECK (
    player_count_min IS NULL
    OR player_count_max IS NULL
    OR player_count_max >= player_count_min
  ),
  CONSTRAINT training_exercises_focus_ok CHECK (
    focus IN (
      'technik', 'koordination', 'dribbling', 'passspiel', 'ballkontrolle',
      'torschuss', 'zweikampf', 'spielform', 'umschalten', 'athletik',
      'torwart', 'abschluss', 'other'
    )
  ),
  CONSTRAINT training_exercises_difficulty_ok CHECK (
    difficulty IN ('easy', 'medium', 'hard')
  ),
  CONSTRAINT training_exercises_phases_nonempty CHECK (cardinality(suitable_phases) >= 1),
  CONSTRAINT training_exercises_phases_ok CHECK (
    suitable_phases <@ ARRAY['AW', 'HT1', 'HT2', 'AK']::text[]
  ),
  CONSTRAINT training_exercises_source_ok CHECK (
    source_type IN ('club', 'import', 'system')
  )
);

COMMENT ON TABLE public.training_exercises IS
  'Vereins-Übungsbibliothek für Manager-Trainingsplanung (STEP 3A).';

CREATE INDEX IF NOT EXISTS idx_training_exercises_club_active
  ON public.training_exercises (club_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_training_exercises_club_focus
  ON public.training_exercises (club_id, focus) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_training_exercises_title_trgm
  ON public.training_exercises (lower(title));

CREATE OR REPLACE FUNCTION public.set_training_exercises_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_exercises_updated_at ON public.training_exercises;
CREATE TRIGGER trg_training_exercises_updated_at
  BEFORE UPDATE ON public.training_exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.set_training_exercises_updated_at();

ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_exercises_select ON public.training_exercises;
CREATE POLICY training_exercises_select ON public.training_exercises
  FOR SELECT TO authenticated
  USING (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exercises_insert ON public.training_exercises;
CREATE POLICY training_exercises_insert ON public.training_exercises
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exercises_update ON public.training_exercises;
CREATE POLICY training_exercises_update ON public.training_exercises
  FOR UPDATE TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exercises_delete ON public.training_exercises;
CREATE POLICY training_exercises_delete ON public.training_exercises
  FOR DELETE TO authenticated
  USING (public.can_manage_club_venues(club_id));

-- ---------------------------------------------------------------------------
-- training_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons (id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events (id) ON DELETE SET NULL,
  title text NOT NULL,
  objective text,
  notes text,
  planned_duration_minutes integer,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_title_nonempty CHECK (length(btrim(title)) > 0),
  CONSTRAINT training_sessions_status_ok CHECK (
    status IN ('draft', 'ready', 'archived')
  ),
  CONSTRAINT training_sessions_duration_ok CHECK (
    planned_duration_minutes IS NULL
    OR (planned_duration_minutes > 0 AND planned_duration_minutes <= 480)
  )
);

COMMENT ON TABLE public.training_sessions IS
  'Trainingseinheit (Plan). Optional 1 aktiver Plan pro Event via Partial Unique Index.';

CREATE INDEX IF NOT EXISTS idx_training_sessions_team_season
  ON public.training_sessions (team_season_id, status);

CREATE INDEX IF NOT EXISTS idx_training_sessions_club
  ON public.training_sessions (club_id) WHERE status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_training_sessions_event
  ON public.training_sessions (event_id) WHERE event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_event_active_unique
  ON public.training_sessions (event_id)
  WHERE event_id IS NOT NULL AND status IN ('draft', 'ready');

CREATE OR REPLACE FUNCTION public.set_training_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_sessions_updated_at ON public.training_sessions;
CREATE TRIGGER trg_training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_training_sessions_updated_at();

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_sessions_select ON public.training_sessions;
CREATE POLICY training_sessions_select ON public.training_sessions
  FOR SELECT TO authenticated
  USING (
    public.can_manage_club_venues(club_id)
    OR public.can_manage_team_staff(team_season_id)
  );

DROP POLICY IF EXISTS training_sessions_insert ON public.training_sessions;
CREATE POLICY training_sessions_insert ON public.training_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_club_venues(club_id)
    AND public.can_manage_team_staff(team_season_id)
  );

DROP POLICY IF EXISTS training_sessions_update ON public.training_sessions;
CREATE POLICY training_sessions_update ON public.training_sessions
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_club_venues(club_id)
    AND public.can_manage_team_staff(team_season_id)
  )
  WITH CHECK (
    public.can_manage_club_venues(club_id)
    AND public.can_manage_team_staff(team_season_id)
  );

DROP POLICY IF EXISTS training_sessions_delete ON public.training_sessions;
CREATE POLICY training_sessions_delete ON public.training_sessions
  FOR DELETE TO authenticated
  USING (
    public.can_manage_club_venues(club_id)
    AND public.can_manage_team_staff(team_season_id)
  );

-- ---------------------------------------------------------------------------
-- training_session_exercises
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id uuid NOT NULL REFERENCES public.training_sessions (id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.training_exercises (id) ON DELETE RESTRICT,
  phase text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL,
  coach_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_exercises_phase_ok CHECK (
    phase IN ('AW', 'HT1', 'HT2', 'AK')
  ),
  CONSTRAINT training_session_exercises_duration_ok CHECK (
    duration_minutes > 0 AND duration_minutes <= 240
  )
);

COMMENT ON TABLE public.training_session_exercises IS
  'Übung innerhalb einer Trainingseinheit (Phase, Reihenfolge, Dauer, Hinweise).';

CREATE INDEX IF NOT EXISTS idx_training_session_exercises_session
  ON public.training_session_exercises (training_session_id, phase, sort_order);

CREATE INDEX IF NOT EXISTS idx_training_session_exercises_exercise
  ON public.training_session_exercises (exercise_id);

CREATE OR REPLACE FUNCTION public.set_training_session_exercises_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_session_exercises_updated_at ON public.training_session_exercises;
CREATE TRIGGER trg_training_session_exercises_updated_at
  BEFORE UPDATE ON public.training_session_exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.set_training_session_exercises_updated_at();

ALTER TABLE public.training_session_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_session_exercises_select ON public.training_session_exercises;
CREATE POLICY training_session_exercises_select ON public.training_session_exercises
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_id
        AND (
          public.can_manage_club_venues(s.club_id)
          OR public.can_manage_team_staff(s.team_season_id)
        )
    )
  );

DROP POLICY IF EXISTS training_session_exercises_insert ON public.training_session_exercises;
CREATE POLICY training_session_exercises_insert ON public.training_session_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_id
        AND public.can_manage_club_venues(s.club_id)
        AND public.can_manage_team_staff(s.team_season_id)
    )
  );

DROP POLICY IF EXISTS training_session_exercises_update ON public.training_session_exercises;
CREATE POLICY training_session_exercises_update ON public.training_session_exercises
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_id
        AND public.can_manage_club_venues(s.club_id)
        AND public.can_manage_team_staff(s.team_season_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_id
        AND public.can_manage_club_venues(s.club_id)
        AND public.can_manage_team_staff(s.team_season_id)
    )
  );

DROP POLICY IF EXISTS training_session_exercises_delete ON public.training_session_exercises;
CREATE POLICY training_session_exercises_delete ON public.training_session_exercises
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_id
        AND public.can_manage_club_venues(s.club_id)
        AND public.can_manage_team_staff(s.team_season_id)
    )
  );
