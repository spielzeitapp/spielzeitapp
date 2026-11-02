-- Presentation belongs to a team-season membership, never the shared player identity.
CREATE OR REPLACE FUNCTION public.valid_player_photo_layout(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT v IS NULL OR coalesce(
 jsonb_typeof(v)='object' AND (SELECT count(*) FROM jsonb_object_keys(v-'numberSize'))=9
 AND (NOT v ? 'numberSize' OR (jsonb_typeof(v->'numberSize')='number' AND (v->>'numberSize')::numeric BETWEEN 20 AND 80))
 AND v->>'background' IN ('blue-left','blue-right','black') AND v->>'source' IN ('original','cutout')
 AND jsonb_typeof(v->'zoom')='number' AND (v->>'zoom')::numeric BETWEEN 50 AND 180
 AND jsonb_typeof(v->'x')='number' AND (v->>'x')::numeric BETWEEN 0 AND 100
 AND jsonb_typeof(v->'y')='number' AND (v->>'y')::numeric BETWEEN 0 AND 100
 AND jsonb_typeof(v->'nameX')='number' AND (v->>'nameX')::numeric BETWEEN 2 AND 65
 AND jsonb_typeof(v->'nameY')='number' AND (v->>'nameY')::numeric BETWEEN 5 AND 85
 AND jsonb_typeof(v->'numberX')='number' AND (v->>'numberX')::numeric BETWEEN 8 AND 92
 AND jsonb_typeof(v->'numberY')='number' AND (v->>'numberY')::numeric BETWEEN 3 AND 85,false)
$$;
ALTER TABLE public.team_seasons ADD COLUMN photo_layout_default jsonb,
 ADD CONSTRAINT team_seasons_photo_layout_default_valid CHECK(public.valid_player_photo_layout(photo_layout_default));
CREATE FUNCTION public.admin_save_global_photo_layout(p_team_season_id uuid,p_layout jsonb,p_expected jsonb DEFAULT NULL,p_replace_individual boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_layout jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_platform_admin(),false) THEN RAISE EXCEPTION 'Admin erforderlich' USING ERRCODE='42501'; END IF;
 SELECT ts.photo_layout_default INTO current_layout FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id
 WHERE ts.id=p_team_season_id AND ts.status IN ('active','draft') AND c.status='active' FOR UPDATE OF ts;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saison schreibgeschützt' USING ERRCODE='42501'; END IF;
 IF current_layout IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Globale Gestaltung wurde inzwischen geändert. Kader neu laden.' USING ERRCODE='40001'; END IF;
 IF NOT public.valid_player_photo_layout(p_layout) THEN RAISE EXCEPTION 'Ungültige Foto-Gestaltung'; END IF;
 UPDATE public.team_seasons SET photo_layout_default=p_layout WHERE id=p_team_season_id;
 IF p_replace_individual THEN UPDATE public.team_season_players SET photo_layout=NULL,updated_at=now() WHERE team_season_id=p_team_season_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_global_photo_layout(uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_global_photo_layout(uuid,jsonb,jsonb,boolean) TO authenticated;
