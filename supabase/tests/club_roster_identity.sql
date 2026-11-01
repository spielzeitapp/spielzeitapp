BEGIN;
DO $$
DECLARE aid uuid; src uuid; dst uuid; foreign_season uuid; pid uuid; outsider uuid; n integer; ctx jsonb; item jsonb;
BEGIN
 SELECT id INTO aid FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF aid IS NULL THEN SELECT user_id INTO aid FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT a.id,b.id INTO src,dst FROM public.team_seasons a JOIN public.teams ta ON ta.id=a.team_id
  JOIN public.teams tb ON tb.club_id=ta.club_id JOIN public.team_seasons b ON b.team_id=tb.id AND b.id<>a.id
  WHERE a.status='active' AND b.status='active' AND public.club_is_operable(ta.club_id) LIMIT 1;
 ASSERT aid IS NOT NULL AND src IS NOT NULL AND dst IS NOT NULL;
 SELECT ts.id INTO foreign_season FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id WHERE t.club_id<>(SELECT t2.club_id FROM public.team_seasons s2 JOIN public.teams t2 ON t2.id=s2.team_id WHERE s2.id=src) LIMIT 1;
 ASSERT foreign_season IS NOT NULL;
 ASSERT NOT has_function_privilege('anon','public.admin_club_roster_context(uuid)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.admin_save_club_roster_player(uuid,jsonb)','EXECUTE');
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.admin_club_roster_context(src);
  RAISE EXCEPTION 'Non-admin accepted' USING ERRCODE='22023';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',aid::text,true);
 item:='{"first_name":"ClubIdentity","last_name":"Synthetic","jersey_number":987,"position":"TW","birthdate":"2014-01-01"}';
 pid:=public.admin_save_club_roster_player(src,item);
 SELECT count(*) INTO n FROM public.players;
 ctx:=public.admin_club_roster_context(dst);
 ASSERT EXISTS(SELECT 1 FROM jsonb_array_elements(ctx) x WHERE x->>'id'=pid::text AND x->'memberships' @> jsonb_build_array(jsonb_build_object('id',src)));
 BEGIN
  PERFORM public.admin_save_club_roster_player(dst,item);
  RAISE EXCEPTION 'Unconfirmed same-name creation accepted' USING ERRCODE='22023';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 ASSERT public.admin_save_club_roster_player(dst,jsonb_build_object('player_id',pid,'jersey_number',986,'position','Abwehr'))=pid;
 ASSERT public.admin_save_club_roster_player(dst,jsonb_build_object('player_id',pid))=pid;
 ASSERT (SELECT count(*)=n FROM public.players);
 ASSERT (SELECT team_season_id=src AND jersey_number=987 AND position='TW' FROM public.players WHERE id=pid);
 ASSERT (SELECT jersey_number=987 AND position='TW' FROM public.team_season_players WHERE player_id=pid AND team_season_id=src);
 ASSERT (SELECT jersey_number=986 AND position='Abwehr' FROM public.team_season_players WHERE player_id=pid AND team_season_id=dst);
 ASSERT (SELECT birthdate='2014-01-01' FROM public.player_profiles WHERE player_id=pid);
 INSERT INTO public.players(team_season_id,first_name,last_name,status,is_active) VALUES(foreign_season,'ClubIdentity','Foreign','active',true) RETURNING id INTO outsider;
 ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ctx) x WHERE x->>'id'=outsider::text);
 BEGIN
  PERFORM public.admin_save_club_roster_player(dst,jsonb_build_object('player_id',outsider));
  RAISE EXCEPTION 'Cross-club profile accepted' USING ERRCODE='22023';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 item:=jsonb_build_object('external_player_id','9999999977','source_name','ClubIdentity Synthetic','player_id',pid,'first_name','ClubIdentity','last_name','Synthetic');
 PERFORM public.admin_import_club_oefb_roster(src,jsonb_build_array(item));
 BEGIN
  PERFORM public.admin_import_club_oefb_roster(dst,jsonb_build_array(item-'player_id'));
  RAISE EXCEPTION 'Known ID created as new profile' USING ERRCODE='22023';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 PERFORM public.admin_import_club_oefb_roster(dst,jsonb_build_array(item));
 ASSERT (SELECT player_id=pid FROM public.oefb_player_links WHERE team_season_id=dst AND external_player_id='9999999977');
 ASSERT (SELECT count(*)=n+1 FROM public.players);
END $$;
ROLLBACK;
