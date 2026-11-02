-- Presentation belongs to a team-season membership, never the shared player identity.
CREATE FUNCTION public.valid_player_photo_layout(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT v IS NULL OR coalesce(
 jsonb_typeof(v)='object' AND (SELECT count(*) FROM jsonb_object_keys(v))=9
 AND v->>'background' IN ('blue-left','blue-right','black') AND v->>'source' IN ('original','cutout')
 AND jsonb_typeof(v->'zoom')='number' AND (v->>'zoom')::numeric BETWEEN 50 AND 180
 AND jsonb_typeof(v->'x')='number' AND (v->>'x')::numeric BETWEEN 0 AND 100
 AND jsonb_typeof(v->'y')='number' AND (v->>'y')::numeric BETWEEN 0 AND 100
 AND jsonb_typeof(v->'nameX')='number' AND (v->>'nameX')::numeric BETWEEN 2 AND 65
 AND jsonb_typeof(v->'nameY')='number' AND (v->>'nameY')::numeric BETWEEN 5 AND 85
 AND jsonb_typeof(v->'numberX')='number' AND (v->>'numberX')::numeric BETWEEN 8 AND 92
 AND jsonb_typeof(v->'numberY')='number' AND (v->>'numberY')::numeric BETWEEN 3 AND 85,false)
$$;
ALTER TABLE public.team_season_players ADD COLUMN photo_layout jsonb,
 ADD CONSTRAINT team_season_players_photo_layout_valid CHECK (public.valid_player_photo_layout(photo_layout));
CREATE FUNCTION public.admin_save_player_photo_layout(p_team_season_id uuid,p_player_id uuid,p_layout jsonb,p_expected jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_layout jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_platform_admin(),false) THEN RAISE EXCEPTION 'Admin erforderlich' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id
 WHERE ts.id=p_team_season_id AND ts.status IN ('active','draft') AND c.status='active' FOR SHARE OF ts,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saison schreibgeschützt' USING ERRCODE='42501'; END IF;
 SELECT photo_layout INTO current_layout FROM public.team_season_players WHERE team_season_id=p_team_season_id AND player_id=p_player_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Spieler gehört nicht zu dieser Mannschaft' USING ERRCODE='42501'; END IF;
 IF current_layout IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Gestaltung wurde inzwischen geändert. Kader neu laden.' USING ERRCODE='40001'; END IF;
 IF NOT public.valid_player_photo_layout(p_layout) THEN RAISE EXCEPTION 'Ungültige Foto-Gestaltung'; END IF;
 UPDATE public.team_season_players SET photo_layout=p_layout,updated_at=now() WHERE team_season_id=p_team_season_id AND player_id=p_player_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_player_photo_layout(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_player_photo_layout(uuid,uuid,jsonb,jsonb) TO authenticated;
