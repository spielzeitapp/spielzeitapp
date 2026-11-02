BEGIN;
DO $$
DECLARE aid uuid; sid uuid; other_sid uuid; pid uuid; v jsonb;
BEGIN
 SELECT id INTO aid FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF aid IS NULL THEN SELECT user_id INTO aid FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT ts.id INTO sid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.status='active' AND c.status='active' LIMIT 1;
 SELECT id INTO other_sid FROM public.team_seasons WHERE id<>sid LIMIT 1;
 ASSERT aid IS NOT NULL AND sid IS NOT NULL AND other_sid IS NOT NULL;
 v:='{"background":"blue-left","source":"original","zoom":100,"x":50,"y":50,"nameX":28,"nameY":85,"numberX":88,"numberY":8}';
 ASSERT public.valid_player_photo_layout(v);
 ASSERT NOT public.valid_player_photo_layout('{}');
 ASSERT NOT public.valid_player_photo_layout(v||'{"zoom":500}');
 ASSERT NOT public.valid_player_photo_layout(v||'{"imageUrl":"https://invalid.test"}');
 ASSERT NOT has_function_privilege('anon','public.admin_save_player_photo_layout(uuid,uuid,jsonb,jsonb)','EXECUTE');
 INSERT INTO public.players(team_season_id,first_name,last_name,is_active,status) VALUES(sid,'PhotoLayout','Synthetic',true,'active') RETURNING id INTO pid;
 INSERT INTO public.team_season_players(player_id,team_season_id,status,is_active) VALUES(pid,sid,'active',true);
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN PERFORM public.admin_save_player_photo_layout(sid,pid,v); RAISE EXCEPTION 'Non-admin accepted' USING ERRCODE='22023'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 BEGIN PERFORM public.admin_save_player_photo_layout(other_sid,pid,v); RAISE EXCEPTION 'Wrong membership accepted' USING ERRCODE='22023'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.admin_save_player_photo_layout(sid,pid,v);
 ASSERT (SELECT photo_layout=v FROM public.team_season_players WHERE player_id=pid AND team_season_id=sid);
 BEGIN PERFORM public.admin_save_player_photo_layout(sid,pid,v); RAISE EXCEPTION 'Stale write accepted' USING ERRCODE='22023'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM public.admin_save_player_photo_layout(sid,pid,NULL,v);
 ASSERT (SELECT photo_layout IS NULL FROM public.team_season_players WHERE player_id=pid AND team_season_id=sid);
END $$;
ROLLBACK;
