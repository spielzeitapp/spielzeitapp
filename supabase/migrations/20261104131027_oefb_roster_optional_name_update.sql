CREATE OR REPLACE FUNCTION public.admin_import_club_oefb_roster(p_team_season_id uuid,p_players jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb; item jsonb; candidate jsonb; pid uuid; ext text; ids uuid[]; payload jsonb:='[]'; created_count integer:=0; result jsonb; names_count integer:=0; affected integer; fn text; ln text;
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
  -- Only explicit opt-in may change an existing profile name. Scope and locks
  -- have already been checked by admin_save_club_roster_player above.
  IF nullif(item->>'player_id','') IS NOT NULL AND coalesce((item->>'take_oefb_name')::boolean,false) THEN
   fn:=btrim(item->>'first_name'); ln:=btrim(item->>'last_name');
   IF length(coalesce(fn,'')) NOT BETWEEN 1 AND 100 OR length(coalesce(ln,'')) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Gültiger ÖFB-Vorname und Nachname erforderlich';
   END IF;
   UPDATE public.players SET first_name=fn,last_name=ln WHERE id=pid
    AND (first_name IS DISTINCT FROM fn OR last_name IS DISTINCT FROM ln);
   GET DIAGNOSTICS affected = ROW_COUNT;
   names_count:=names_count+affected;
  END IF;
  payload:=payload||jsonb_build_array(item||jsonb_build_object('player_id',pid));
 END LOOP;
 result:=public.import_oefb_roster(p_team_season_id,payload);
 RETURN result||jsonb_build_object('created',created_count,'names_updated',names_count);
END $$;
REVOKE ALL ON FUNCTION public.admin_import_club_oefb_roster(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_import_club_oefb_roster(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
