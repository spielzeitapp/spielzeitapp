BEGIN;
DO $$
DECLARE aid uuid; sid uuid; pid uuid; eid uuid; mid uuid; r jsonb;
BEGIN
 SELECT id INTO aid FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF aid IS NULL THEN SELECT user_id INTO aid FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT ts.id INTO sid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.status='active' AND c.status='active' LIMIT 1;
 INSERT INTO public.events(team_season_id,kind,type,match_type,opponent,is_home,starts_at,status,external_source,external_id) VALUES(sid,'match','game','friendly','Synthetic opponent',false,now()-interval '3 days','upcoming','oefb','99999999997') RETURNING id INTO eid;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.import_oefb_results(sid,'[]'); RAISE EXCEPTION 'Non-staff accepted' USING ERRCODE='22023'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 r:=public.import_oefb_results(sid,'[{"external_id":"99999999997","score_home":0,"score_away":6}]'); ASSERT (r->>'imported')::int=1;
 SELECT match_id INTO mid FROM public.events WHERE id=eid;
 ASSERT (SELECT score_home=0 AND score_away=6 AND status='finished' FROM public.matches WHERE id=mid);
 ASSERT (SELECT status='finished' AND fixture_status='published' FROM public.events WHERE id=eid);
 r:=public.import_oefb_results(sid,'[{"external_id":"99999999997","score_home":9,"score_away":9}]'); ASSERT (r->>'protected')::int=1;
 ASSERT (SELECT score_home=0 AND score_away=6 FROM public.matches WHERE id=mid);
 BEGIN PERFORM public.import_oefb_results(sid,'[{"external_id":"99999999997","score_home":-1,"score_away":0}]'); RAISE EXCEPTION 'Invalid score accepted' USING ERRCODE='22023'; EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
ROLLBACK;
