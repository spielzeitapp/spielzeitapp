-- Turnierplan MVP (Step 2): Teilnehmer + Turnierspiele → bestehendes Match.

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  group_label text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_event
  ON public.tournament_participants(tournament_event_id);

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  opponent_name text NOT NULL,
  kickoff_at timestamptz NOT NULL,
  planned_minutes integer NOT NULL DEFAULT 60,
  pitch text NULL,
  group_label text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_matches_match_id_unique UNIQUE (match_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_event
  ON public.tournament_matches(tournament_event_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_kickoff
  ON public.tournament_matches(tournament_event_id, kickoff_at);

COMMENT ON TABLE public.tournament_participants IS
  'Mannschaften im Turnier (Anzeige/Gruppen), unabhängig vom Kader.';
COMMENT ON TABLE public.tournament_matches IS
  'Turnierspiel-Slot: verknüpft Turnier-Event mit normalem public.matches-Datensatz.';

-- RLS tournament_participants
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_participants_select ON public.tournament_participants;
CREATE POLICY tournament_participants_select ON public.tournament_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_participants.tournament_event_id
        AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tournament_participants_insert ON public.tournament_participants;
CREATE POLICY tournament_participants_insert ON public.tournament_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_participants.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_participants_update ON public.tournament_participants;
CREATE POLICY tournament_participants_update ON public.tournament_participants
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_participants.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_participants.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_participants_delete ON public.tournament_participants;
CREATE POLICY tournament_participants_delete ON public.tournament_participants
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_participants.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

-- RLS tournament_matches
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_matches_select ON public.tournament_matches;
CREATE POLICY tournament_matches_select ON public.tournament_matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_matches.tournament_event_id
        AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tournament_matches_insert ON public.tournament_matches;
CREATE POLICY tournament_matches_insert ON public.tournament_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_matches.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_matches_update ON public.tournament_matches;
CREATE POLICY tournament_matches_update ON public.tournament_matches
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_matches.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_matches.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS tournament_matches_delete ON public.tournament_matches;
CREATE POLICY tournament_matches_delete ON public.tournament_matches
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.memberships ms ON ms.team_season_id = e.team_season_id
      WHERE e.id = tournament_matches.tournament_event_id
        AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
