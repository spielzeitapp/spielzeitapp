-- Turnier-Import: alternative Teamnamen pro Team-Saison (Step 9).

CREATE TABLE IF NOT EXISTS public.team_season_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_season_aliases_team_alias_ci
  ON public.team_season_aliases (team_season_id, lower(trim(alias)));

CREATE INDEX IF NOT EXISTS idx_team_season_aliases_team_season
  ON public.team_season_aliases (team_season_id);

COMMENT ON TABLE public.team_season_aliases IS
  'Alternative Namen für Turnierplan-Import (z. B. NSG Rohrbach vs. U12 SPG Rohrbach).';

ALTER TABLE public.team_season_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_season_aliases_select ON public.team_season_aliases;
CREATE POLICY team_season_aliases_select ON public.team_season_aliases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.team_season_id = team_season_aliases.team_season_id
        AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS team_season_aliases_insert ON public.team_season_aliases;
CREATE POLICY team_season_aliases_insert ON public.team_season_aliases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.team_season_id = team_season_aliases.team_season_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS team_season_aliases_delete ON public.team_season_aliases;
CREATE POLICY team_season_aliases_delete ON public.team_season_aliases
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.team_season_id = team_season_aliases.team_season_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
