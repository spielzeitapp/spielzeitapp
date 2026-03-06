-- Live-Persistenz und Tore: neue Spalten in public.matches (IF NOT EXISTS)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS live_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_elapsed_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_is_running bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_home int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_away int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_period int NOT NULL DEFAULT 1;

-- Optional: match_events für Tor Auswärts (ohne player_id) und Undo
CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  type text NOT NULL,
  minute int,
  period int,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match_created ON public.match_events(match_id, created_at DESC);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- RLS: gleicher Zugriff wie matches (Team-Mitglieder lesen, Trainer/Admin schreiben)
DROP POLICY IF EXISTS "match_events_select_team_members" ON public.match_events;
CREATE POLICY match_events_select_team_members ON public.match_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_events.match_id AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "match_events_insert_trainer_admin" ON public.match_events;
CREATE POLICY match_events_insert_trainer_admin ON public.match_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_events.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );

DROP POLICY IF EXISTS "match_events_delete_trainer_admin" ON public.match_events;
CREATE POLICY match_events_delete_trainer_admin ON public.match_events
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.memberships ms ON ms.team_season_id = m.team_season_id
      WHERE m.id = match_events.match_id AND ms.user_id = auth.uid()
        AND ms.role IN ('trainer', 'admin')
    )
  );
