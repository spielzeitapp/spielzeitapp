-- Turnier: manuell ergänzte Torschützen (ohne match_events zu verändern).

CREATE TABLE IF NOT EXISTS public.tournament_manual_goal_scorers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  goals integer NOT NULL CHECK (goals > 0),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_manual_goal_scorers_event_player_unique UNIQUE (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_manual_goal_scorers_event
  ON public.tournament_manual_goal_scorers(event_id);

COMMENT ON TABLE public.tournament_manual_goal_scorers IS
  'Manuell gepflegte Turnier-Torschützen pro Spieler (ergänzt match_events).';

ALTER TABLE public.tournament_manual_goal_scorers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_manual_goal_scorers_select ON public.tournament_manual_goal_scorers;
CREATE POLICY tournament_manual_goal_scorers_select ON public.tournament_manual_goal_scorers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_manual_goal_scorers.event_id
        AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tournament_manual_goal_scorers_insert ON public.tournament_manual_goal_scorers;
CREATE POLICY tournament_manual_goal_scorers_insert ON public.tournament_manual_goal_scorers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_manual_goal_scorers.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_manual_goal_scorers_update ON public.tournament_manual_goal_scorers;
CREATE POLICY tournament_manual_goal_scorers_update ON public.tournament_manual_goal_scorers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_manual_goal_scorers.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_manual_goal_scorers.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_manual_goal_scorers_delete ON public.tournament_manual_goal_scorers;
CREATE POLICY tournament_manual_goal_scorers_delete ON public.tournament_manual_goal_scorers
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_manual_goal_scorers.event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
