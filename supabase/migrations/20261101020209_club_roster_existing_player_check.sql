-- Same-club identity lookup and explicit additional membership; TEST rollout only.
CREATE OR REPLACE FUNCTION public.admin_club_roster_context(p_team_season_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_platform_admin(),false) THEN RAISE EXCEPTION 'Admin erforderlich' USING ERRCODE='42501'; END IF;
 SELECT t.club_id INTO cid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id WHERE ts.id=p_team_season_id;
 IF cid IS NULL THEN RAISE EXCEPTION 'Mannschaft nicht gefunden'; END IF;
 WITH memberships AS (
  SELECT sp.player_id,sp.team_season_id FROM public.team_season_players sp
  UNION SELECT id,team_season_id FROM public.players WHERE team_season_id IS NOT NULL
 ), scoped AS (
  SELECT m.player_id,m.team_season_id,coalesce(nullif(ts.display_name,''),t.name||' · '||coalesce(ts.age_group,'')||' · '||s.name) AS label
  FROM memberships m JOIN public.team_seasons ts ON ts.id=m.team_season_id JOIN public.teams t ON t.id=ts.team_id
  JOIN public.seasons s ON s.id=ts.season_id WHERE t.club_id=cid
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,
  'memberships',(SELECT jsonb_agg(jsonb_build_object('id',x.team_season_id,'label',x.label)) FROM scoped x WHERE x.player_id=p.id),
  'external_ids',(SELECT coalesce(jsonb_agg(DISTINCT l.external_player_id),'[]'::jsonb) FROM public.oefb_player_links l
   JOIN public.team_seasons ts ON ts.id=l.team_season_id JOIN public.teams t ON t.id=ts.team_id WHERE l.player_id=p.id AND t.club_id=cid)
 )),'[]'::jsonb) INTO result FROM public.players p WHERE EXISTS(SELECT 1 FROM scoped x WHERE x.player_id=p.id);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_club_roster_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_club_roster_context(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_club_roster_player(p_team_season_id uuid,p_player jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; pid uuid; ctx jsonb; item jsonb; fn text; ln text; num integer;
BEGIN
 ctx:=public.admin_club_roster_context(p_team_season_id); -- auth and target scope
 SELECT t.club_id INTO cid FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
  JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=p_team_season_id AND ts.status IN ('active','draft') AND c.status='active' FOR SHARE OF ts,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saison schreibgeschützt' USING ERRCODE='42501'; END IF;
 -- Serialize identity creation within a club and roster writes within the destination season.
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,411));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_team_season_id::text,410));
 ctx:=public.admin_club_roster_context(p_team_season_id);
 pid:=nullif(p_player->>'player_id','')::uuid;
 fn:=btrim(p_player->>'first_name'); ln:=btrim(p_player->>'last_name');
 IF pid IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ctx) x WHERE x->>'id'=pid::text) THEN RAISE EXCEPTION 'Profil gehört nicht zum Verein' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.players WHERE id=pid FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.team_season_players WHERE player_id=pid AND team_season_id=p_team_season_id) THEN RETURN pid; END IF;
 ELSE
  IF length(coalesce(fn,'')) NOT BETWEEN 1 AND 100 OR length(coalesce(ln,'')) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Vorname und Nachname erforderlich'; END IF;
  IF NOT coalesce((p_player->>'distinct_person')::boolean,false) AND EXISTS(SELECT 1 FROM jsonb_array_elements(ctx) x
   WHERE lower(regexp_replace(btrim(x->>'first_name'),'\s+',' ','g'))=lower(regexp_replace(fn,'\s+',' ','g'))
    AND lower(regexp_replace(btrim(x->>'last_name'),'\s+',' ','g'))=lower(regexp_replace(ln,'\s+',' ','g'))) THEN
   RAISE EXCEPTION 'Namensgleiches Profil vorhanden. Vorhandenes Profil wählen oder andere Person ausdrücklich bestätigen.';
  END IF;
 END IF;
 IF nullif(p_player->>'jersey_number','') IS NOT NULL THEN
  IF p_player->>'jersey_number' !~ '^\d{1,3}$' THEN RAISE EXCEPTION 'Ungültige Rückennummer'; END IF;
  num:=(p_player->>'jersey_number')::integer;
  IF EXISTS(SELECT 1 FROM public.team_season_players WHERE team_season_id=p_team_season_id AND player_id IS DISTINCT FROM pid AND jersey_number=num AND status<>'archived') THEN RAISE EXCEPTION 'Rückennummer bereits vergeben'; END IF;
 END IF;
 IF pid IS NULL THEN
  INSERT INTO public.players(team_season_id,first_name,last_name,jersey_number,position,status,is_active,is_laz_player)
   VALUES(p_team_season_id,fn,ln,num,nullif(p_player->>'position',''),'active',true,false) RETURNING id INTO pid;
  INSERT INTO public.player_profiles(player_id,birthdate) VALUES(pid,nullif(p_player->>'birthdate','')::date);
 END IF;
 INSERT INTO public.team_season_players(player_id,team_season_id,jersey_number,position,status,is_active,is_laz_player)
  VALUES(pid,p_team_season_id,num,nullif(p_player->>'position',''),'active',true,false);
 RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_club_roster_player(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_club_roster_player(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_import_club_oefb_roster(p_team_season_id uuid,p_players jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb; item jsonb; candidate jsonb; pid uuid; ext text; ids uuid[]; payload jsonb:='[]'; created_count integer:=0; result jsonb;
BEGIN
 ctx:=public.admin_club_roster_context(p_team_season_id);
 IF jsonb_typeof(p_players) IS DISTINCT FROM 'array' OR jsonb_array_length(p_players)>100 THEN RAISE EXCEPTION 'Ungültiger Kader'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_players) LOOP
  ext:=item->>'external_player_id'; pid:=nullif(item->>'player_id','')::uuid;
  SELECT array_agg((x->>'id')::uuid) INTO ids FROM jsonb_array_elements(ctx) x WHERE x->'external_ids' ? ext;
  IF coalesce(cardinality(ids),0)>1 THEN RAISE EXCEPTION 'ÖFB-ID mehreren Profilen zugeordnet. Bitte zuerst bereinigen.'; END IF;
  IF coalesce(cardinality(ids),0)>0 AND (pid IS NULL OR NOT pid=ANY(ids)) THEN RAISE EXCEPTION 'ÖFB-ID bereits im Verein vorhanden. Bestehendes Profil ausdrücklich wählen.'; END IF;
  -- Joining the chosen existing profile and the import happen in one transaction.
  IF pid IS NULL THEN created_count:=created_count+1; END IF;
  pid:=public.admin_save_club_roster_player(p_team_season_id,item-'jersey_number');
  payload:=payload||jsonb_build_array(item||jsonb_build_object('player_id',pid));
 END LOOP;
 result:=public.import_oefb_roster(p_team_season_id,payload);
 RETURN result||jsonb_build_object('created',created_count);
END $$;
REVOKE ALL ON FUNCTION public.admin_import_club_oefb_roster(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_import_club_oefb_roster(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
