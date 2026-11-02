BEGIN;
DO $$
DECLARE aid uuid; sid uuid; pid uuid; other_pid uuid; r jsonb; before_players bigint; before_members bigint; payload jsonb;
BEGIN
 SELECT id INTO aid FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF aid IS NULL THEN SELECT user_id INTO aid FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT ts.id,p.id INTO sid,pid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id JOIN public.players p ON p.team_season_id=ts.id WHERE ts.status='active' AND c.status='active' LIMIT 1;
 ASSERT aid IS NOT NULL AND pid IS NOT NULL;
 SELECT count(*) INTO before_players FROM public.players;
 SELECT count(*) INTO before_members FROM public.team_season_players;
 payload:=jsonb_build_array(jsonb_build_object('external_player_id','9999999911','source_name','Synthetic alias','player_id',pid),jsonb_build_object('external_player_id','9999999912','source_name','Synthetic alias','player_id',pid));
 ASSERT NOT EXISTS(SELECT 1 FROM public.oefb_player_links WHERE team_season_id=sid AND external_player_id IN ('9999999911','9999999912'));
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.save_oefb_player_assignments(sid,payload,'[]'); RAISE EXCEPTION 'Non-staff accepted' USING ERRCODE='22023'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 r:=public.save_oefb_player_assignments(sid,payload,'[]');
 ASSERT (r->>'created')::int=0 AND (r->>'mapped')::int=2;
 r:=public.save_oefb_player_assignments(sid,payload,'[]');
 ASSERT (r->>'created')::int=0;
 ASSERT (SELECT count(*)=2 FROM public.oefb_player_links WHERE team_season_id=sid AND external_player_id IN ('9999999911','9999999912') AND player_id=pid);
 ASSERT (SELECT count(*) FROM public.players)=before_players;
 ASSERT (SELECT count(*) FROM public.team_season_players)=before_members;
 -- An external ID must still be unique within the season.
 BEGIN
  INSERT INTO public.oefb_player_links(team_season_id,external_player_id,player_id,source_name,confirmed_by) VALUES(sid,'9999999911',pid,'Duplicate source',aid);
  RAISE EXCEPTION 'Duplicate source ID accepted' USING ERRCODE='22023';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
