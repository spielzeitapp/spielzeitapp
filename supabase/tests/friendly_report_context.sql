BEGIN;
DO $$
DECLARE aid uuid; sid uuid; mid uuid; ctx jsonb; r jsonb;
BEGIN
 SELECT id INTO aid FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF aid IS NULL THEN SELECT user_id INTO aid FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT ts.id INTO sid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.status='active' AND c.status='active' LIMIT 1;
 INSERT INTO public.matches(team_season_id,opponent,match_date,status,score_home,score_away,motm_enabled,auto_matchday_feed_enabled) VALUES(sid,'Synthetic report',now()-interval '2 days','finished',0,0,false,false) RETURNING id INTO mid;
 INSERT INTO public.events(team_season_id,kind,type,match_type,opponent,is_home,starts_at,status,external_source,external_id,match_id) VALUES(sid,'match','game','friendly','Synthetic report',true,now()-interval '2 days','finished','oefb','9999999996',mid);
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.oefb_assignment_context(sid); RAISE EXCEPTION 'Non-staff accepted' USING ERRCODE='22023'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 ctx:=public.oefb_assignment_context(sid);ASSERT EXISTS(SELECT 1 FROM jsonb_array_elements(ctx->'games') g WHERE g->>'external_id'='9999999996');
 r:=public.save_oefb_player_assignments(sid,'[]','[{"external_id":"9999999996","score_home":0,"score_away":0,"goals":[]}]');
 ASSERT (r->>'protected_matches')::int=0;
 ASSERT (SELECT score_home=0 AND score_away=0 FROM public.matches WHERE id=mid);
END $$;
ROLLBACK;
