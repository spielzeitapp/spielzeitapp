-- Team-Push-Vorlagen + Basis für Automatisierung (ohne UI)

CREATE TABLE IF NOT EXISTS public.push_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  created_by uuid NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_templates_team_created
  ON public.push_templates (team_id, created_at DESC);

ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_templates_select_staff" ON public.push_templates;
CREATE POLICY "push_templates_select_staff"
  ON public.push_templates
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = push_templates.team_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "push_templates_insert_staff" ON public.push_templates;
CREATE POLICY "push_templates_insert_staff"
  ON public.push_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = push_templates.team_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "push_templates_delete_staff" ON public.push_templates;
CREATE POLICY "push_templates_delete_staff"
  ON public.push_templates
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = push_templates.team_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DO $$
BEGIN
  CREATE TYPE public.push_automation_trigger AS ENUM ('match_before', 'training_before');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.push_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  template_id uuid NULL REFERENCES public.push_templates(id) ON DELETE SET NULL,
  trigger_type public.push_automation_trigger NOT NULL,
  minutes_before integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_automations_team
  ON public.push_automations (team_id);

ALTER TABLE public.push_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_automations_select_staff" ON public.push_automations;
CREATE POLICY "push_automations_select_staff"
  ON public.push_automations
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = push_automations.team_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

COMMENT ON TABLE public.push_automations IS 'Vorbereitung automatischer Pushes; später per Job/Scheduler.';

SELECT pg_notify('pgrst', 'reload schema');
