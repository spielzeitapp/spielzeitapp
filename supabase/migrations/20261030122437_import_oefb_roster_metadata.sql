-- Reuse the existing scoped identity/roster operation; no match reports supplied.
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
    AND NOT EXISTS(SELECT 1 FROM public.team_season_players other WHERE other.team_season_id=p_team_season_id AND other.player_id<>pid AND other.jersey_number=jersey);
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
