-- ÖFB-D-Trainerprüfung: persönliche Sammlung von 10 bearbeitbaren Trainingseinheiten.
-- Die Sammlung referenziert die Einheiten; Exporte werden stets aus dem aktuellen Stand erzeugt.
-- Nur auf Staging/develop anwenden, bevor Production ausdrücklich freigegeben ist.

CREATE TABLE IF NOT EXISTS public.training_exam_documentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'ÖFB-D-Diplom Dokumentation',
  required_units integer NOT NULL DEFAULT 10 CHECK (required_units BETWEEN 1 AND 20),
  deadline date NULL,
  export_version integer NOT NULL DEFAULT 0 CHECK (export_version >= 0),
  last_exported_at timestamptz NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_season_id, created_by)
);

CREATE TABLE IF NOT EXISTS public.training_exam_documentation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documentation_id uuid NOT NULL REFERENCES public.training_exam_documentations(id) ON DELETE CASCADE,
  training_session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL CHECK (sort_order >= 0 AND sort_order < 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documentation_id, training_session_id),
  UNIQUE (documentation_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_training_exam_docs_club_season
  ON public.training_exam_documentations (club_id, team_season_id);
CREATE INDEX IF NOT EXISTS idx_training_exam_items_documentation
  ON public.training_exam_documentation_items (documentation_id, sort_order);

ALTER TABLE public.training_exam_documentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exam_documentation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_exam_documentations_select ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_select ON public.training_exam_documentations
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exam_documentations_insert ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_insert ON public.training_exam_documentations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exam_documentations_update ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_update ON public.training_exam_documentations
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.can_manage_club_venues(club_id))
  WITH CHECK (created_by = auth.uid() AND public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exam_documentations_delete ON public.training_exam_documentations;
CREATE POLICY training_exam_documentations_delete ON public.training_exam_documentations
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS training_exam_documentation_items_select ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_select ON public.training_exam_documentation_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_club_venues(d.club_id)
  ));

DROP POLICY IF EXISTS training_exam_documentation_items_insert ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_insert ON public.training_exam_documentation_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_club_venues(d.club_id)
  ));

DROP POLICY IF EXISTS training_exam_documentation_items_update ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_update ON public.training_exam_documentation_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_club_venues(d.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_club_venues(d.club_id)
  ));

DROP POLICY IF EXISTS training_exam_documentation_items_delete ON public.training_exam_documentation_items;
CREATE POLICY training_exam_documentation_items_delete ON public.training_exam_documentation_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_exam_documentations d
    WHERE d.id = documentation_id
      AND d.created_by = auth.uid()
      AND public.can_manage_club_venues(d.club_id)
  ));

SELECT pg_notify('pgrst', 'reload schema');
