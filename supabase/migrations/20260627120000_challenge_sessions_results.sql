-- Jonglier-Challenge (MVP): Sessions + Ergebnisse pro Spieler

CREATE TABLE IF NOT EXISTS public.challenge_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'juggling',
  title text NOT NULL,
  start_date date NULL,
  end_date date NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
  min_start_for_percent integer NOT NULL DEFAULT 3 CHECK (min_start_for_percent >= 0),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_sessions_team_type_status
  ON public.challenge_sessions (team_season_id, type, status);

DROP TRIGGER IF EXISTS trg_challenge_sessions_updated_at ON public.challenge_sessions;
CREATE TRIGGER trg_challenge_sessions_updated_at
  BEFORE UPDATE ON public.challenge_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.challenge_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenge_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  start_value integer NOT NULL DEFAULT 0 CHECK (start_value >= 0),
  end_value integer NULL CHECK (end_value IS NULL OR end_value >= 0),
  notes text NULL,
  recorded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_results_challenge_id
  ON public.challenge_results (challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_results_player_id
  ON public.challenge_results (player_id);

DROP TRIGGER IF EXISTS trg_challenge_results_updated_at ON public.challenge_results;
CREATE TRIGGER trg_challenge_results_updated_at
  BEFORE UPDATE ON public.challenge_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.challenge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_results ENABLE ROW LEVEL SECURITY;

-- challenge_sessions: nur Staff
DROP POLICY IF EXISTS challenge_sessions_staff_all ON public.challenge_sessions;
CREATE POLICY challenge_sessions_staff_all
  ON public.challenge_sessions
  FOR ALL
  TO authenticated
  USING (public.can_manage_team_staff(team_season_id))
  WITH CHECK (public.can_manage_team_staff(team_season_id));

-- challenge_results: Staff über zugehörige Session
DROP POLICY IF EXISTS challenge_results_staff_all ON public.challenge_results;
CREATE POLICY challenge_results_staff_all
  ON public.challenge_results
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_sessions AS cs
      WHERE cs.id = challenge_results.challenge_id
        AND public.can_manage_team_staff(cs.team_season_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.challenge_sessions AS cs
      WHERE cs.id = challenge_results.challenge_id
        AND public.can_manage_team_staff(cs.team_season_id)
    )
  );

COMMENT ON TABLE public.challenge_sessions IS 'Team-Challenges (MVP: Jonglieren) pro Saison.';
COMMENT ON TABLE public.challenge_results IS 'Start-/Endwerte pro Spieler und Challenge-Session.';
