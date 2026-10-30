-- TEST only; all data writes are rolled back.
BEGIN;
DO $$
DECLARE admin_id uuid; season_id uuid; v_pid uuid; data jsonb; second jsonb; payload jsonb; amount integer;
BEGIN
 SELECT id INTO admin_id FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF admin_id IS NULL THEN SELECT user_id INTO admin_id FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 ASSERT admin_id IS NOT NULL;
 SELECT ts.id INTO season_id FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
 WHERE ts.status='active' AND public.club_is_operable(t.club_id) LIMIT 1;
 ASSERT season_id IS NOT NULL;
 ASSERT NOT has_function_privilege('anon','public.import_oefb_roster(uuid,jsonb)','EXECUTE');
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.import_oefb_roster(season_id,'[]');
  RAISE EXCEPTION 'Non-admin accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 ASSERT NOT EXISTS(SELECT 1 FROM public.oefb_player_links WHERE team_season_id=season_id AND external_player_id='9999999999');
 payload:=jsonb_build_array(jsonb_build_object('external_player_id','9999999999','source_name','Import Testperson','first_name','Import','last_name','Testperson','jersey_number',987,'photo_url','https://vereine.oefb.at/netzwerk/imagedownload/test.jpg'));
 data:=public.import_oefb_roster(season_id,payload);
 ASSERT (data->>'created')::int=1 AND (data->>'numbers_added')::int=1 AND (data->>'photos_added')::int=1;
 SELECT l.player_id INTO v_pid FROM public.oefb_player_links l WHERE l.team_season_id=season_id AND l.external_player_id='9999999999';
 ASSERT (SELECT jersey_number=987 FROM public.team_season_players tsp WHERE tsp.player_id=v_pid AND tsp.team_season_id=season_id);
 ASSERT (SELECT avatar_url='https://vereine.oefb.at/netzwerk/imagedownload/test.jpg' FROM public.player_avatars a WHERE a.player_id=v_pid);
 SELECT count(*) INTO amount FROM public.players;
 second:=public.import_oefb_roster(season_id,payload);
 ASSERT (second->>'created')::int=0 AND (second->>'numbers_added')::int=0 AND (second->>'photos_added')::int=0;
 ASSERT (SELECT count(*)=amount FROM public.players);
 -- Explicitly proposed replacement values must not replace existing metadata.
 payload:=jsonb_set(jsonb_set(payload,'{0,jersey_number}','988'),'{0,photo_url}','"https://vereine.oefb.at/netzwerk/imagedownload/other.jpg"');
 second:=public.import_oefb_roster(season_id,payload);
 ASSERT (second->>'numbers_added')::int=0 AND (second->>'photos_added')::int=0;
 ASSERT (SELECT jersey_number=987 FROM public.team_season_players tsp WHERE tsp.player_id=v_pid AND tsp.team_season_id=season_id);
 ASSERT (SELECT avatar_url='https://vereine.oefb.at/netzwerk/imagedownload/test.jpg' FROM public.player_avatars a WHERE a.player_id=v_pid);
 -- A bad photo must roll back player creation as well.
 payload:=jsonb_build_array(jsonb_build_object('external_player_id','9999999998','source_name','Invalid Testperson','first_name','Invalid','last_name','Testperson','photo_url','https://example.com/portrait.jpg'));
 BEGIN
  PERFORM public.import_oefb_roster(season_id,payload);
  RAISE EXCEPTION 'Unsafe photo accepted' USING ERRCODE='22023';
 EXCEPTION WHEN raise_exception THEN NULL;
 END;
 ASSERT (SELECT count(*)=amount FROM public.players);
 ASSERT NOT EXISTS(SELECT 1 FROM public.oefb_player_links l WHERE l.team_season_id=season_id AND l.external_player_id='9999999998');
END $$;
ROLLBACK;
