-- RSVP (Zu-/Absage) pro Spiel pro Spieler
CREATE TABLE IF NOT EXISTS public.match_rsvps (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE public.match_rsvps ENABLE ROW LEVEL SECURITY;

-- Lesen: Team-Mitglieder (matches.team_season_id → memberships)
CREATE POLICY match_rsvps_select_team
  ON public.match_rsvps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_rsvps.match_id AND ms.user_id = auth.uid()
    )
  );

-- Schreiben: Trainer/Admin für Matches des Teams; Eltern für eigene Spieler (player_guardians)
CREATE POLICY match_rsvps_insert_team_staff
  ON public.match_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_rsvps.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );

CREATE POLICY match_rsvps_insert_parent_own
  ON public.match_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid() AND pg.player_id = match_rsvps.player_id
    )
  );

CREATE POLICY match_rsvps_update_team_staff
  ON public.match_rsvps FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_rsvps.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );

CREATE POLICY match_rsvps_update_parent_own
  ON public.match_rsvps FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid() AND pg.player_id = match_rsvps.player_id
    )
  );
