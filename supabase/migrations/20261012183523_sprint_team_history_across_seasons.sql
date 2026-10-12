CREATE OR REPLACE FUNCTION private.team_sprint_history(p_team_season_id uuid)
RETURNS TABLE(challenge_id uuid,player_id uuid,team_season_id uuid,start_date date,created_at timestamptz,measurement_method text,attempt_1_ms integer,attempt_2_ms integer,attempt_3_ms integer,participation text,best_ms integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT cs.id,r.player_id,cs.team_season_id,cs.start_date,cs.created_at,cs.measurement_method,r.attempt_1_ms,r.attempt_2_ms,r.attempt_3_ms,r.participation,r.best_ms
 FROM public.sprint_challenge_results r JOIN public.challenge_sessions cs ON cs.id=r.challenge_id
 JOIN public.team_seasons history_season ON history_season.id=cs.team_season_id
 JOIN public.team_seasons current_season ON current_season.id=p_team_season_id AND current_season.team_id=history_season.team_id
 WHERE cs.type='sprint_16_5' AND (SELECT auth.uid()) IS NOT NULL
 AND public.can_manage_team_staff(p_team_season_id)
 AND public.player_in_team_season(r.player_id,p_team_season_id)
 ORDER BY coalesce(cs.start_date,cs.created_at::date),cs.created_at,cs.id;
$$;
REVOKE ALL ON FUNCTION private.team_sprint_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.team_sprint_history(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_team_sprint_history(p_team_season_id uuid)
RETURNS TABLE(challenge_id uuid,player_id uuid,team_season_id uuid,start_date date,created_at timestamptz,measurement_method text,attempt_1_ms integer,attempt_2_ms integer,attempt_3_ms integer,participation text,best_ms integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM private.team_sprint_history(p_team_season_id); $$;
REVOKE ALL ON FUNCTION public.get_team_sprint_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_team_sprint_history(uuid) TO authenticated;