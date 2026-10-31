-- Platform-admin-only roster lifecycle. No existing player is changed by this migration.
CREATE OR REPLACE FUNCTION public.admin_roster_player_action(
 p_team_season_id uuid, p_player_id uuid, p_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.players%rowtype; ref record; used boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_platform_admin(),false) THEN
  RAISE EXCEPTION 'Nur Plattformadmins können Spieler entfernen.' USING ERRCODE='42501';
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('remove','delete') THEN RAISE EXCEPTION 'Ungültige Aktion'; END IF;
 PERFORM 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
  JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=p_team_season_id
  AND ts.status IN ('active','draft') AND c.status='active' FOR SHARE OF ts,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Diese Mannschaftssaison ist schreibgeschützt.' USING ERRCODE='42501'; END IF;
 -- Same lock as the ÖFB importer, then player lock prevents new FK references during deletion.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_team_season_id::text,410));
 SELECT * INTO p FROM public.players WHERE id=p_player_id FOR UPDATE;
 IF NOT FOUND OR NOT coalesce((p.team_season_id=p_team_season_id OR EXISTS(
  SELECT 1 FROM public.team_season_players WHERE player_id=p_player_id AND team_season_id=p_team_season_id)),false) THEN
  RAISE EXCEPTION 'Spieler gehört nicht zu dieser Mannschaftssaison.' USING ERRCODE='42501';
 END IF;
 IF p_action='remove' THEN
  -- Keep membership and historical jersey/position; only retire this season's membership.
  INSERT INTO public.team_season_players(player_id,team_season_id,jersey_number,position,status,is_active,left_at)
   VALUES(p_player_id,p_team_season_id,p.jersey_number,p.position,'archived',false,now())
   ON CONFLICT(player_id,team_season_id) DO UPDATE SET status='archived',is_active=false,
    left_at=coalesce(public.team_season_players.left_at,now()),updated_at=now();
  UPDATE public.players SET status='archived',is_active=false
   WHERE id=p_player_id AND team_season_id=p_team_season_id;
 ELSE
  IF p.team_season_id IS DISTINCT FROM p_team_season_id OR EXISTS(
   SELECT 1 FROM public.team_season_players WHERE player_id=p_player_id AND team_season_id<>p_team_season_id) THEN
   RAISE EXCEPTION 'Spieler hat weitere Mannschaftszuordnungen. Bitte nur aus dem Kader entfernen.';
  END IF;
  -- Fail closed for every current/future FK, including CASCADE and SET NULL references.
  -- Only the current membership and profile/photo metadata may disappear with an unused profile.
  FOR ref IN SELECT c.conrelid::regclass AS tab,a.attname AS col FROM pg_constraint c
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
   WHERE c.contype='f' AND c.confrelid='public.players'::regclass
   AND c.conrelid NOT IN ('public.team_season_players'::regclass,'public.player_profiles'::regclass,'public.player_avatars'::regclass)
  LOOP
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I=$1)',ref.tab,ref.col) INTO used USING p_player_id;
   IF used THEN RAISE EXCEPTION 'Spieler wird bereits verwendet (Spieldaten, ÖFB-Verknüpfung oder Zugänge). Bitte nur aus dem Kader entfernen.'; END IF;
  END LOOP;
  -- Also protect denormalized publications/lineups/feed payloads without FK constraints.
  FOR ref IN SELECT n.nspname,c.relname,a.attname,a.atttypid FROM pg_attribute a
   JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
   AND (a.atttypid IN ('jsonb'::regtype,'json'::regtype,'uuid[]'::regtype)
    OR (a.atttypid='uuid'::regtype AND a.attname LIKE '%player%'))
   AND c.relname NOT IN ('team_season_players','player_profiles','player_avatars')
  LOOP
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text LIKE $1)',ref.nspname,ref.relname,ref.attname)
    INTO used USING '%'||p_player_id::text||'%';
   IF used THEN RAISE EXCEPTION 'Spieler wird bereits in gespeicherten Daten verwendet. Bitte nur aus dem Kader entfernen.'; END IF;
  END LOOP;
  DELETE FROM public.players WHERE id=p_player_id;
 END IF;
 -- A reviewed roster must be checked again after a membership change.
 UPDATE public.manager_setup_progress SET checks=checks||'{"roster":"open","review":"open"}'::jsonb,
  updated_at=now(),updated_by=auth.uid() WHERE team_season_id=p_team_season_id;
 RETURN jsonb_build_object('ok',true,'action',p_action);
END $$;
REVOKE ALL ON FUNCTION public.admin_roster_player_action(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_roster_player_action(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Archived memberships retain their historical numbers but do not reserve active jersey numbers.
CREATE OR REPLACE FUNCTION public.import_oefb_roster(p_team_season_id uuid,p_players jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; item jsonb; pid uuid; jersey integer; photo text;
 numbers_added integer:=0; photos_added integer:=0;
BEGIN
 -- The existing operation checks auth.uid(), staff/platform-admin, writable season,
 -- player ownership, duplicates, and serializes all writes to this season.
 result:=public.save_oefb_player_assignments(p_team_season_id,p_players,'[]'::jsonb);
 FOR item IN SELECT value FROM jsonb_array_elements(p_players) LOOP
  SELECT player_id INTO pid FROM public.oefb_player_links
   WHERE team_season_id=p_team_season_id AND external_player_id=item->>'external_player_id';
  IF coalesce(item->>'jersey_number','') <> '' THEN
   IF item->>'jersey_number' !~ '^\d{1,3}$' THEN RAISE EXCEPTION 'Ungültige Rückennummer'; END IF;
   jersey:=(item->>'jersey_number')::integer;
   -- Existing season numbers and conflicting numbers are deliberately retained.
   UPDATE public.team_season_players t SET jersey_number=jersey
    WHERE t.team_season_id=p_team_season_id AND t.player_id=pid AND t.jersey_number IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.team_season_players other WHERE other.team_season_id=p_team_season_id AND other.player_id<>pid AND other.jersey_number=jersey AND other.status<>'archived' AND other.is_active);
   IF FOUND THEN
    numbers_added:=numbers_added+1;
    UPDATE public.players SET jersey_number=jersey WHERE id=pid AND team_season_id=p_team_season_id AND jersey_number IS NULL;
   END IF;
  END IF;
  photo:=nullif(item->>'photo_url','');
  IF photo IS NOT NULL THEN
   IF photo !~ '^https://vereine\.oefb\.at/netzwerk/imagedownload/[a-zA-Z0-9_.%-]+$' THEN RAISE EXCEPTION 'Ungültiger ÖFB-Fotolink'; END IF;
   INSERT INTO public.player_avatars(player_id,avatar_url)
    SELECT pid,photo WHERE NOT EXISTS(SELECT 1 FROM public.players WHERE id=pid AND nullif(cutout_url,'') IS NOT NULL)
    ON CONFLICT(player_id) DO UPDATE SET avatar_url=excluded.avatar_url,updated_at=now()
    WHERE nullif(public.player_avatars.avatar_url,'') IS NULL;
   IF FOUND THEN photos_added:=photos_added+1; END IF;
  END IF;
 END LOOP;
 RETURN result || jsonb_build_object('numbers_added',numbers_added,'photos_added',photos_added);
END $$;
REVOKE ALL ON FUNCTION public.import_oefb_roster(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_oefb_roster(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
