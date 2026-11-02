BEGIN;
DO $$
DECLARE aid uuid; sid uuid; pid uuid; v jsonb; old_default jsonb;
BEGIN
 SELECT id INTO aid FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF aid IS NULL THEN SELECT user_id INTO aid FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT ts.id,ts.photo_layout_default INTO sid,old_default FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.status='active' AND c.status='active' LIMIT 1;
 v:='{"background":"black","source":"original","zoom":100,"x":50,"y":50,"nameX":28,"nameY":85,"numberX":88,"numberY":8,"numberSize":70}';
 ASSERT public.valid_player_photo_layout(v);
 ASSERT NOT public.valid_player_photo_layout(v||'{"numberSize":999}');
 ASSERT NOT has_function_privilege('anon','public.admin_save_global_photo_layout(uuid,jsonb,jsonb,boolean)','EXECUTE');
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.admin_save_global_photo_layout(sid,v,old_default); RAISE EXCEPTION 'Non-admin accepted' USING ERRCODE='22023'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 INSERT INTO public.players(team_season_id,first_name,last_name,status,is_active) VALUES(sid,'GlobalPhoto','Synthetic','active',true) RETURNING id INTO pid;
 INSERT INTO public.team_season_players(player_id,team_season_id,status,is_active,photo_layout) VALUES(pid,sid,'active',true,v);
 PERFORM public.admin_save_global_photo_layout(sid,v,old_default,false);
 ASSERT (SELECT photo_layout=v FROM public.team_season_players WHERE player_id=pid AND team_season_id=sid);
 BEGIN PERFORM public.admin_save_global_photo_layout(sid,v,NULL); RAISE EXCEPTION 'Stale global write accepted' USING ERRCODE='22023'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM public.admin_save_global_photo_layout(sid,v,v,true);
 ASSERT (SELECT photo_layout IS NULL FROM public.team_season_players WHERE player_id=pid AND team_season_id=sid);
 ASSERT (SELECT photo_layout_default=v FROM public.team_seasons WHERE id=sid);
 PERFORM public.admin_save_global_photo_layout(sid,NULL,v,false);
 ASSERT (SELECT photo_layout_default IS NULL FROM public.team_seasons WHERE id=sid);
END $$;
ROLLBACK;
