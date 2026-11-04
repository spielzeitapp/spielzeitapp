CREATE OR REPLACE FUNCTION public.import_oefb_staff_member(
 p_team_season_id uuid, p_user_id uuid, p_role text, p_source_url text,
 p_take_name boolean DEFAULT false, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL,
 p_take_photo boolean DEFAULT false, p_photo_url text DEFAULT NULL, p_cutout_url text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.can_manage_team_staff(p_team_season_id),false) THEN
  RAISE EXCEPTION 'Keine Berechtigung zur Trainerverwaltung' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id
  WHERE ts.id=p_team_season_id AND ts.status IN ('active','draft') AND c.status='active' FOR SHARE OF ts,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saison ist schreibgeschützt' USING ERRCODE='42501'; END IF;
 IF p_source_url IS NULL OR p_source_url !~* '^https://vereine\.oefb\.at/[a-z0-9-]+/Mannschaften/Saison-[a-z0-9-]+/[a-z0-9-]+/Trainer-Betreuer/?$' THEN
  RAISE EXCEPTION 'Ungültiger ÖFB-Trainerlink';
 END IF;
 IF coalesce(p_take_name,false) AND (length(coalesce(btrim(p_first_name),'')) NOT BETWEEN 1 AND 100 OR length(coalesce(btrim(p_last_name),'')) NOT BETWEEN 1 AND 100) THEN
  RAISE EXCEPTION 'Vorname und Nachname prüfen';
 END IF;
 IF coalesce(p_take_photo,false) AND (p_photo_url IS NULL OR p_photo_url !~ '^https://vereine\.oefb\.at/netzwerk/imagedownload/[a-zA-Z0-9_.%-]+$') THEN
  RAISE EXCEPTION 'Ungültiges ÖFB-Trainerfoto';
 END IF;
 IF p_cutout_url IS NOT NULL AND (NOT coalesce(p_take_photo,false) OR p_cutout_url !~ (
  '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/team-photos/'||p_team_season_id::text||'/cutouts/'||p_user_id::text||'\.(png|webp)(\?v=[0-9]+)?$'
 )) THEN RAISE EXCEPTION 'Ungültiger Freisteller'; END IF;
 -- Existing operation checks account existence and restricts membership roles.
 PERFORM public.upsert_team_staff_member(p_team_season_id,p_user_id,p_role,
  CASE WHEN p_take_name THEN btrim(p_first_name) ELSE NULL END,
  CASE WHEN p_take_name THEN btrim(p_last_name) ELSE NULL END,NULL,NULL,NULL,NULL);
 IF coalesce(p_take_photo,false) THEN
  -- A cutout belongs to its source photo. Do not retain a cutout of a replaced photo.
  UPDATE public.profiles SET avatar_url=p_photo_url,cutout_url=p_cutout_url WHERE id=p_user_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.import_oefb_staff_member(uuid,uuid,text,text,boolean,text,text,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_oefb_staff_member(uuid,uuid,text,text,boolean,text,text,boolean,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
