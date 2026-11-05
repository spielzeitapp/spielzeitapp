-- A public ÖFB listing is a source, not ownership of a team.
CREATE TABLE public.oefb_team_import_sources (
 source_url text PRIMARY KEY,
 team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
 discovered_in_club_id uuid NOT NULL REFERENCES public.clubs(id),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (source_url ~ '^https://vereine[.]oefb[.]at/[a-z0-9-]+/mannschaften/saison-[0-9]{4}-[0-9]{2}/[a-z0-9-]+/kader$')
);
CREATE INDEX oefb_team_import_sources_target ON public.oefb_team_import_sources(team_season_id);
CREATE INDEX oefb_team_import_sources_club ON public.oefb_team_import_sources(discovered_in_club_id);
CREATE INDEX oefb_team_import_sources_creator ON public.oefb_team_import_sources(created_by);
ALTER TABLE public.oefb_team_import_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oefb_team_import_sources FROM anon,authenticated;
GRANT SELECT,INSERT ON public.oefb_team_import_sources TO authenticated;
CREATE POLICY admin_read_import_sources ON public.oefb_team_import_sources FOR SELECT TO authenticated
 USING ((select auth.uid()) IS NOT NULL AND (select public.is_platform_admin()));
CREATE POLICY admin_add_import_sources ON public.oefb_team_import_sources FOR INSERT TO authenticated
 WITH CHECK ((select auth.uid()) IS NOT NULL AND (select public.is_platform_admin()) AND created_by=(select auth.uid()));
CREATE FUNCTION public.admin_link_oefb_team_source(p_source_url text,p_team_season_id uuid,p_discovered_in_club_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_source text:=lower(rtrim(btrim(p_source_url),'/')); v_season text; v_existing uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT s.name INTO v_season FROM public.team_seasons ts JOIN public.seasons s ON s.id=ts.season_id
 JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id
 WHERE ts.id=p_team_season_id AND ts.status IN ('active','draft') AND c.status='active';
 IF v_season IS NULL OR NOT public.club_is_operable(p_discovered_in_club_id) THEN RAISE EXCEPTION 'Aktive Zielmannschaft und aktiver Quellverein erforderlich'; END IF;
 IF v_source !~ ('^https://vereine[.]oefb[.]at/[a-z0-9-]+/mannschaften/saison-'||replace(v_season,'/','-')||'/[a-z0-9-]+/kader$') THEN RAISE EXCEPTION 'ÖFB-Link passt nicht zur Zielsaison'; END IF;
 INSERT INTO public.oefb_team_import_sources(source_url,team_season_id,discovered_in_club_id)
 VALUES(v_source,p_team_season_id,p_discovered_in_club_id) ON CONFLICT(source_url) DO NOTHING;
 SELECT team_season_id INTO v_existing FROM public.oefb_team_import_sources WHERE source_url=v_source;
 IF v_existing IS DISTINCT FROM p_team_season_id THEN RAISE EXCEPTION 'Diese ÖFB-Quelle ist bereits einer anderen Mannschaft zugeordnet. Bestehende Zuordnung verwenden.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_link_oefb_team_source(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_link_oefb_team_source(text,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
