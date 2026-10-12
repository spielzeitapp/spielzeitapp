-- Player-owned challenge history, with explicit staff/guardian access checks.
CREATE OR REPLACE FUNCTION private.player_juggling_history(p_player_id uuid)
RETURNS TABLE(challenge_id uuid,team_season_id uuid,title text,start_date date,created_at timestamptz,updated_at timestamptz,start_value integer,end_value integer,notes text,min_start_for_percent integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT cs.id,cs.team_season_id,cs.title,cs.start_date,cs.created_at,r.updated_at,
 r.start_value,r.end_value,r.notes,cs.min_start_for_percent
 FROM public.challenge_results r
 JOIN public.challenge_sessions cs ON cs.id=r.challenge_id
 JOIN public.team_seasons ts ON ts.id=cs.team_season_id
 WHERE r.player_id=p_player_id AND cs.type='juggling' AND (SELECT auth.uid()) IS NOT NULL
 AND (
 public.can_manage_team_staff(cs.team_season_id)
 OR EXISTS(SELECT 1 FROM public.team_seasons managed
   WHERE managed.team_id=ts.team_id AND public.can_manage_team_staff(managed.id)
   AND public.player_in_team_season(p_player_id,managed.id))
 OR EXISTS(SELECT 1 FROM public.player_guardians pg WHERE pg.player_id=p_player_id AND pg.user_id=(SELECT auth.uid()))
 OR EXISTS(SELECT 1 FROM public.player_users pu WHERE pu.player_id=p_player_id AND pu.user_id=(SELECT auth.uid()))
 )
 ORDER BY coalesce(cs.start_date,r.updated_at::date),r.updated_at,cs.id;
$$;
REVOKE ALL ON FUNCTION private.player_juggling_history(uuid) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.player_juggling_history(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_player_juggling_history(p_player_id uuid)
RETURNS TABLE(challenge_id uuid,team_season_id uuid,title text,start_date date,created_at timestamptz,updated_at timestamptz,start_value integer,end_value integer,notes text,min_start_for_percent integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM private.player_juggling_history(p_player_id); $$;
REVOKE ALL ON FUNCTION public.get_player_juggling_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_juggling_history(uuid) TO authenticated;

