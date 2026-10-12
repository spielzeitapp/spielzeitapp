ALTER TABLE public.sprint_challenge_results
 ADD COLUMN participation text CHECK (participation IS NULL OR participation IN ('participated','absent')),
 ADD CONSTRAINT sprint_absent_has_no_times CHECK (participation IS DISTINCT FROM 'absent' OR (attempt_1_ms IS NULL AND attempt_2_ms IS NULL AND attempt_3_ms IS NULL));
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.player_sprint_history(p_player_id uuid)
RETURNS TABLE(challenge_id uuid,team_season_id uuid,start_date date,created_at timestamptz,measurement_method text,attempt_1_ms integer,attempt_2_ms integer,attempt_3_ms integer,participation text,best_ms integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT cs.id,cs.team_season_id,cs.start_date,cs.created_at,cs.measurement_method,
 r.attempt_1_ms,r.attempt_2_ms,r.attempt_3_ms,r.participation,r.best_ms
 FROM public.sprint_challenge_results r JOIN public.challenge_sessions cs ON cs.id=r.challenge_id
 WHERE r.player_id=p_player_id AND cs.type='sprint_16_5' AND (SELECT auth.uid()) IS NOT NULL
 AND (public.can_manage_team_staff(cs.team_season_id)
 OR EXISTS(SELECT 1 FROM public.player_guardians pg WHERE pg.player_id=p_player_id AND pg.user_id=(SELECT auth.uid()))
 OR EXISTS(SELECT 1 FROM public.player_users pu WHERE pu.player_id=p_player_id AND pu.user_id=(SELECT auth.uid())))
 ORDER BY coalesce(cs.start_date,cs.created_at::date),cs.created_at,cs.id;
$$;
REVOKE ALL ON FUNCTION private.player_sprint_history(uuid) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.player_sprint_history(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_player_sprint_history(p_player_id uuid)
RETURNS TABLE(challenge_id uuid,team_season_id uuid,start_date date,created_at timestamptz,measurement_method text,attempt_1_ms integer,attempt_2_ms integer,attempt_3_ms integer,participation text,best_ms integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM private.player_sprint_history(p_player_id); $$;
REVOKE ALL ON FUNCTION public.get_player_sprint_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_sprint_history(uuid) TO authenticated;
