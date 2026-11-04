ALTER TABLE public.memberships ADD COLUMN photo_layout jsonb,
 ADD CONSTRAINT memberships_photo_layout_valid CHECK(public.valid_player_photo_layout(photo_layout));
CREATE FUNCTION public.list_team_staff_with_photo_layout(p_team_season_id uuid)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(s)||jsonb_build_object('photo_layout',m.photo_layout)
 FROM public.list_team_staff_for_season(p_team_season_id) s
 JOIN public.memberships m ON m.team_season_id=p_team_season_id AND m.user_id=s.user_id AND m.role::text=s.role;
$$;
REVOKE ALL ON FUNCTION public.list_team_staff_with_photo_layout(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_team_staff_with_photo_layout(uuid) TO authenticated;
CREATE FUNCTION public.save_staff_photo_layout(p_team_season_id uuid,p_user_id uuid,p_layout jsonb,p_expected jsonb DEFAULT NULL,p_cutout_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_layout jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.can_manage_team_staff(p_team_season_id),false) THEN RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id
 WHERE ts.id=p_team_season_id AND ts.status IN ('active','draft') AND c.status='active' FOR SHARE OF ts,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saison schreibgeschützt' USING ERRCODE='42501'; END IF;
 SELECT photo_layout INTO old_layout FROM public.memberships WHERE team_season_id=p_team_season_id AND user_id=p_user_id AND role::text IN ('trainer','head_coach','co_trainer') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trainer gehört nicht zu dieser Mannschaft' USING ERRCODE='42501'; END IF;
 IF old_layout IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Gestaltung wurde inzwischen geändert. Trainer neu laden.' USING ERRCODE='40001'; END IF;
 IF NOT public.valid_player_photo_layout(p_layout) THEN RAISE EXCEPTION 'Ungültige Foto-Gestaltung'; END IF;
 IF p_cutout_url IS NOT NULL THEN
  IF p_layout IS NULL OR p_layout->>'source'<>'cutout' OR p_cutout_url !~ ('^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/team-photos/'||p_team_season_id::text||'/cutouts/'||p_user_id::text||'[.](png|webp)([?]v=[0-9]+)?$') THEN RAISE EXCEPTION 'Ungültiger Freisteller'; END IF;
  UPDATE public.profiles SET cutout_url=p_cutout_url WHERE id=p_user_id;
 END IF;
 UPDATE public.memberships SET photo_layout=p_layout WHERE team_season_id=p_team_season_id AND user_id=p_user_id AND role::text IN ('trainer','head_coach','co_trainer');
END $$;
REVOKE ALL ON FUNCTION public.save_staff_photo_layout(uuid,uuid,jsonb,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_staff_photo_layout(uuid,uuid,jsonb,jsonb,text) TO authenticated;

NOTIFY pgrst,'reload schema';
