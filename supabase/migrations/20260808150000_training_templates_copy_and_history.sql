-- STEP 3C Manager: Vorlagen, Kopieren, Dokumentation, Chronik.
-- Additive only. Events bleiben Terminobjekt; keine Attendance-/Platz-Writes.
-- Ziel: Staging acbaecjzoabafbsjrzvr — NICHT Production shxugattqatahckhspwk.

-- ---------------------------------------------------------------------------
-- training_sessions: record_type, Quellen, Dokumentation, Status completed
-- ---------------------------------------------------------------------------

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES public.training_sessions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.training_sessions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS focus text,
  ADD COLUMN IF NOT EXISTS age_group text,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_rating text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS worked_well text,
  ADD COLUMN IF NOT EXISTS needs_improvement text,
  ADD COLUMN IF NOT EXISTS repeat_next_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- Status: completed ergänzen (bestehende Check-Constraint ersetzen)
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_status_ok;

ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_status_ok CHECK (
    status IN ('draft', 'ready', 'completed', 'archived')
  );

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_record_type_ok;

ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_record_type_ok CHECK (
    record_type IN ('session', 'template')
  );

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_template_no_event;

ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_template_no_event CHECK (
    record_type <> 'template' OR event_id IS NULL
  );

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_actual_duration_ok;

ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_actual_duration_ok CHECK (
    actual_duration_minutes IS NULL
    OR (actual_duration_minutes > 0 AND actual_duration_minutes <= 480)
  );

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_review_rating_ok;

ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_review_rating_ok CHECK (
    review_rating IS NULL
    OR review_rating IN ('excellent', 'good', 'partial', 'off_plan')
  );

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_focus_ok;

ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_focus_ok CHECK (
    focus IS NULL
    OR focus IN (
      'technik', 'koordination', 'dribbling', 'passspiel', 'ballkontrolle',
      'torschuss', 'zweikampf', 'spielform', 'umschalten', 'athletik',
      'torwart', 'abschluss', 'other'
    )
  );

-- Partial Unique: nur konkrete Sessions (nicht Vorlagen), aktive Pläne
DROP INDEX IF EXISTS public.idx_training_sessions_event_active_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_event_active_unique
  ON public.training_sessions (event_id)
  WHERE event_id IS NOT NULL
    AND record_type = 'session'
    AND status IN ('draft', 'ready');

CREATE INDEX IF NOT EXISTS idx_training_sessions_record_type
  ON public.training_sessions (club_id, record_type, status);

CREATE INDEX IF NOT EXISTS idx_training_sessions_completed
  ON public.training_sessions (team_season_id, completed_at DESC)
  WHERE record_type = 'session' AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_training_sessions_template_id
  ON public.training_sessions (template_id)
  WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_source
  ON public.training_sessions (source_session_id)
  WHERE source_session_id IS NOT NULL;

COMMENT ON COLUMN public.training_sessions.record_type IS
  'session = konkrete Einheit; template = wiederverwendbare Vorlage ohne Termin (STEP 3C).';
COMMENT ON COLUMN public.training_sessions.source_session_id IS
  'Quelle beim Kopieren (Original-Session oder Vorlage).';
COMMENT ON COLUMN public.training_sessions.template_id IS
  'Vorlage, aus der diese Session erzeugt wurde (unveränderliche Referenz).';

-- ---------------------------------------------------------------------------
-- training_session_exercises: Nachbereitung
-- ---------------------------------------------------------------------------

ALTER TABLE public.training_session_exercises
  ADD COLUMN IF NOT EXISTS was_completed boolean,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS repeat_recommended boolean NOT NULL DEFAULT false;

ALTER TABLE public.training_session_exercises
  DROP CONSTRAINT IF EXISTS training_session_exercises_review_status_ok;

ALTER TABLE public.training_session_exercises
  ADD CONSTRAINT training_session_exercises_review_status_ok CHECK (
    review_status IS NULL
    OR review_status IN ('worked_well', 'adapted', 'not_done', 'repeat')
  );

ALTER TABLE public.training_session_exercises
  DROP CONSTRAINT IF EXISTS training_session_exercises_actual_duration_ok;

ALTER TABLE public.training_session_exercises
  ADD CONSTRAINT training_session_exercises_actual_duration_ok CHECK (
    actual_duration_minutes IS NULL
    OR (actual_duration_minutes > 0 AND actual_duration_minutes <= 240)
  );

-- RLS unverändert: bestehende Policies decken neue Spalten ab (gleiche Tabellen).

NOTIFY pgrst, 'reload schema';
