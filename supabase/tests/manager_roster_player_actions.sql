-- Uses synthetic profiles only. All test writes are rolled back.
BEGIN;
DO $$
DECLARE admin_id uuid; sid uuid; other_sid uuid; pid uuid; other_pid uuid; payload jsonb;
BEGIN
 SELECT id INTO admin_id FROM public.profiles WHERE is_admin=true LIMIT 1;
 IF admin_id IS NULL THEN SELECT user_id INTO admin_id FROM public.user_roles WHERE lower(trim(role))='admin' LIMIT 1; END IF;
 SELECT ts.id INTO sid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
  WHERE ts.status='active' AND public.club_is_operable(t.club_id) LIMIT 1;
 SELECT id INTO other_sid FROM public.team_seasons WHERE id<>sid LIMIT 1;
 ASSERT admin_id IS NOT NULL AND sid IS NOT NULL AND other_sid IS NOT NULL;
 ASSERT NOT has_function_privilege('anon','public.admin_roster_player_action(uuid,uuid,text)','EXECUTE');
 INSERT INTO public.players(team_season_id,first_name,last_name,jersey_number,status,is_active)
  VALUES(sid,'Lifecycle','Synthetic',986,'active',true) RETURNING id INTO pid;
 INSERT INTO public.team_season_players(player_id,team_season_id,jersey_number,status,is_active) VALUES(pid,sid,986,'active',true);
 INSERT INTO public.player_profiles(player_id) VALUES(pid) ON CONFLICT DO NOTHING;
 INSERT INTO public.player_avatars(player_id,avatar_url) VALUES(pid,'https://example.invalid/synthetic.jpg');
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN
  PERFORM public.admin_roster_player_action(sid,pid,'delete');
  RAISE EXCEPTION 'Anonymous accepted' USING ERRCODE='22023';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 BEGIN
  PERFORM public.admin_roster_player_action(sid,pid,'delete');
  RAISE EXCEPTION 'Non-admin accepted' USING ERRCODE='22023';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 BEGIN
  PERFORM public.admin_roster_player_action(other_sid,pid,'remove');
  RAISE EXCEPTION 'Foreign season accepted' USING ERRCODE='22023';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- A cascading ÖFB identity reference must block deletion and remain intact.
 INSERT INTO public.oefb_player_links(team_season_id,external_player_id,player_id,source_name,confirmed_by)
  VALUES(sid,'9999999987',pid,'Lifecycle Synthetic',admin_id);
 BEGIN
  PERFORM public.admin_roster_player_action(sid,pid,'delete');
  RAISE EXCEPTION 'Used profile deleted' USING ERRCODE='22023';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 ASSERT EXISTS(SELECT 1 FROM public.oefb_player_links WHERE player_id=pid);
 PERFORM public.admin_roster_player_action(sid,pid,'remove');
 ASSERT (SELECT status='archived' AND NOT is_active AND jersey_number=986 AND left_at IS NOT NULL
  FROM public.team_season_players WHERE player_id=pid AND team_season_id=sid);
 ASSERT (SELECT status='archived' AND NOT is_active FROM public.players WHERE id=pid);
 ASSERT EXISTS(SELECT 1 FROM public.oefb_player_links WHERE player_id=pid);
 ASSERT EXISTS(SELECT 1 FROM public.player_avatars WHERE player_id=pid);
 -- The archived number can be imported for an active profile.
 payload:=jsonb_build_array(jsonb_build_object('external_player_id','9999999986','source_name','Lifecycle Second','first_name','Lifecycle','last_name','Second','jersey_number',986));
 PERFORM public.import_oefb_roster(sid,payload);
 SELECT player_id INTO other_pid FROM public.oefb_player_links WHERE team_season_id=sid AND external_player_id='9999999986';
 ASSERT (SELECT jersey_number=986 FROM public.team_season_players WHERE player_id=other_pid AND team_season_id=sid);
 DELETE FROM public.oefb_player_links WHERE player_id=pid;
 INSERT INTO public.team_season_players(player_id,team_season_id,status,is_active) VALUES(pid,other_sid,'active',true);
 BEGIN
  PERFORM public.admin_roster_player_action(sid,pid,'delete');
  RAISE EXCEPTION 'Other membership deleted' USING ERRCODE='22023';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 ASSERT EXISTS(SELECT 1 FROM public.team_season_players WHERE player_id=pid AND team_season_id=other_sid);
 DELETE FROM public.team_season_players WHERE player_id=pid AND team_season_id=other_sid;
 PERFORM public.admin_roster_player_action(sid,pid,'delete');
 ASSERT NOT EXISTS(SELECT 1 FROM public.players WHERE id=pid);
 ASSERT NOT EXISTS(SELECT 1 FROM public.team_season_players WHERE player_id=pid);
 ASSERT NOT EXISTS(SELECT 1 FROM public.player_profiles WHERE player_id=pid);
 ASSERT NOT EXISTS(SELECT 1 FROM public.player_avatars WHERE player_id=pid);
 ASSERT EXISTS(SELECT 1 FROM public.players WHERE id=other_pid);
 -- A published lineup without an FK must also block deletion.
 INSERT INTO public.players(team_season_id,first_name,last_name,status,is_active) VALUES(sid,'Lifecycle','Published','active',true) RETURNING id INTO pid;
 -- Inject the synthetic ID into an existing JSON payload only within this rollback transaction.
 UPDATE public.team_feed_posts SET payload=coalesce(public.team_feed_posts.payload,'{}'::jsonb)||jsonb_build_object('lifecycle_test_player_id',pid) WHERE id=(SELECT id FROM public.team_feed_posts LIMIT 1);
 IF FOUND THEN
  BEGIN
   PERFORM public.admin_roster_player_action(sid,pid,'delete');
   RAISE EXCEPTION 'Published profile deleted' USING ERRCODE='22023';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  ASSERT EXISTS(SELECT 1 FROM public.players WHERE id=pid);
 END IF;
END $$;
ROLLBACK;
