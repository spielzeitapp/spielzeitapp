-- Three sprint attempts in integer milliseconds, fastest valid attempt wins.
ALTER TABLE public.challenge_sessions ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;
CREATE TABLE public.sprint_challenge_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenge_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  attempt_1_ms integer CHECK (attempt_1_ms BETWEEN 1 AND 60000),
  attempt_2_ms integer CHECK (attempt_2_ms BETWEEN 1 AND 60000),
  attempt_3_ms integer CHECK (attempt_3_ms BETWEEN 1 AND 60000),
  best_ms integer GENERATED ALWAYS AS (least(attempt_1_ms,attempt_2_ms,attempt_3_ms)) STORED,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id,player_id)
);
CREATE INDEX sprint_challenge_results_player_idx ON public.sprint_challenge_results(player_id);
CREATE TRIGGER sprint_challenge_results_updated_at BEFORE UPDATE ON public.sprint_challenge_results
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.sprint_challenge_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY sprint_challenge_results_staff_select ON public.sprint_challenge_results
FOR SELECT TO authenticated USING (EXISTS (
 SELECT 1 FROM public.challenge_sessions cs WHERE cs.id=challenge_id AND cs.type='sprint_16_5'
 AND public.can_manage_team_staff(cs.team_season_id)
));
CREATE POLICY sprint_challenge_results_staff_insert ON public.sprint_challenge_results
FOR INSERT TO authenticated WITH CHECK (EXISTS (
 SELECT 1 FROM public.challenge_sessions cs JOIN public.team_seasons ts ON ts.id=cs.team_season_id
 WHERE cs.id=challenge_id AND cs.type='sprint_16_5' AND cs.status='active' AND ts.status='active'
 AND public.can_manage_team_staff(cs.team_season_id) AND public.player_in_team_season(player_id,cs.team_season_id)
) AND recorded_by=auth.uid());
CREATE POLICY sprint_challenge_results_staff_update ON public.sprint_challenge_results
FOR UPDATE TO authenticated USING (EXISTS (
 SELECT 1 FROM public.challenge_sessions cs JOIN public.team_seasons ts ON ts.id=cs.team_season_id
 WHERE cs.id=challenge_id AND cs.type='sprint_16_5' AND cs.status='active' AND ts.status='active'
 AND public.can_manage_team_staff(cs.team_season_id)
)) WITH CHECK (EXISTS (
 SELECT 1 FROM public.challenge_sessions cs JOIN public.team_seasons ts ON ts.id=cs.team_season_id
 WHERE cs.id=challenge_id AND cs.type='sprint_16_5' AND cs.status='active' AND ts.status='active'
 AND public.can_manage_team_staff(cs.team_season_id) AND public.player_in_team_season(player_id,cs.team_season_id)
) AND recorded_by=auth.uid());
GRANT SELECT,INSERT,UPDATE ON public.sprint_challenge_results TO authenticated;
COMMENT ON TABLE public.sprint_challenge_results IS 'Torlinie bis 16er: three attempts per test/player; fastest time in milliseconds.';
