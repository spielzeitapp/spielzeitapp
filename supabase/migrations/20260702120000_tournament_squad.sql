-- Turnierkader: einmal pro Turnier-Event, Basis für Match-Vorbereitung der Turnierspiele.

CREATE TABLE IF NOT EXISTS public.tournament_squad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_squad_event_player_unique UNIQUE (tournament_event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_squad_event
  ON public.tournament_squad(tournament_event_id);

COMMENT ON TABLE public.tournament_squad IS
  'Nominierte Spieler für ein Turnier (turnierweit), unabhängig von match_bench pro Spiel.';

ALTER TABLE public.tournament_squad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_squad_select ON public.tournament_squad;
CREATE POLICY tournament_squad_select ON public.tournament_squad
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_squad.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS tournament_squad_insert ON public.tournament_squad;
CREATE POLICY tournament_squad_insert ON public.tournament_squad
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_squad.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_squad_delete ON public.tournament_squad;
CREATE POLICY tournament_squad_delete ON public.tournament_squad
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_squad.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
