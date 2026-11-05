-- Add a narrow platform-admin command; no new table grants or public data access.
CREATE FUNCTION public.admin_set_team_season_club_table(p_team_season_id uuid,p_url text,p_team_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_url text:=btrim(coalesce(p_url,'')); v_name text:=btrim(coalesce(p_team_name,'')); v_season text; v_competition text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Nur Plattformadmin.' USING ERRCODE='42501'; END IF;
 IF v_url !~* '^https://vereine[.]oefb[.]at/[a-z0-9-]+/Mannschaften/Saison-[0-9]{4}-[0-9]{2}/[a-z0-9-]+/Tabellen/?$' OR v_name='' OR length(v_name)>120 THEN RAISE EXCEPTION 'Ungültige Tabellenquelle oder Mannschaft.'; END IF;
 SELECT s.name,ts.oefb_table_competition_id INTO v_season,v_competition FROM public.team_seasons ts JOIN public.seasons s ON s.id=ts.season_id JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=p_team_season_id AND ts.status='active' AND c.status='active' FOR UPDATE OF ts;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aktive Mannschaftssaison nicht gefunden.'; END IF;
 IF nullif(v_competition,'') IS NOT NULL THEN RAISE EXCEPTION 'Eine Bewerbstabelle ist bereits zugeordnet. Bestehende Zuordnung bleibt erhalten.'; END IF;
 IF position('/Saison-'||replace(v_season,'/','-')||'/' in v_url)=0 THEN RAISE EXCEPTION 'Tabellenquelle gehört zu einer anderen Saison.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.oefb_team_import_sources m WHERE m.team_season_id=p_team_season_id AND m.source_url=lower(regexp_replace(v_url,'/Tabellen/?$','/Kader','i'))) THEN RAISE EXCEPTION 'Zuerst die ÖFB-Mannschaft eindeutig zuordnen.'; END IF;
 UPDATE public.team_seasons SET oefb_table_url=v_url,oefb_table_team_name=v_name WHERE id=p_team_season_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_team_season_club_table(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_team_season_club_table(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
