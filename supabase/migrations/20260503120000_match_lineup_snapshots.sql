-- Kickoff-/Initial-Lineup pro Spiel (unveränderlich nach erstem Insert); für spätere Spielerstatistiken.

CREATE TABLE IF NOT EXISTS public.match_lineup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  slot text NOT NULL,
  snapshot_type text NOT NULL DEFAULT 'kickoff',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_lineup_snapshots_match_type_slot_uniq UNIQUE (match_id, snapshot_type, slot)
);

CREATE INDEX IF NOT EXISTS idx_match_lineup_snapshots_match_type
  ON public.match_lineup_snapshots (match_id, snapshot_type);

COMMENT ON TABLE public.match_lineup_snapshots IS
  'Feste Kopie der Startelf zum Anpfiff (snapshot_type=kickoff); wird einmalig beim Live-Start angelegt.';

ALTER TABLE public.match_lineup_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_lineup_snapshots_select_team_members ON public.match_lineup_snapshots;
CREATE POLICY match_lineup_snapshots_select_team_members ON public.match_lineup_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup_snapshots.match_id AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS match_lineup_snapshots_insert_staff ON public.match_lineup_snapshots;
CREATE POLICY match_lineup_snapshots_insert_staff ON public.match_lineup_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_lineup_snapshots.match_id AND ms.user_id = auth.uid()
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );
