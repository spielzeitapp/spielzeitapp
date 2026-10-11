-- Test-first setup assistant: isolated progress and atomic additional-team creation.
CREATE TABLE public.manager_setup_progress (
  team_season_id uuid PRIMARY KEY REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checks) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.manager_setup_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_setup_progress FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.manager_setup_progress TO authenticated;
CREATE POLICY setup_admin_select ON public.manager_setup_progress FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));
CREATE POLICY setup_admin_insert ON public.manager_setup_progress FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_platform_admin()) AND updated_by = (SELECT auth.uid()));
CREATE POLICY setup_admin_update ON public.manager_setup_progress FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()) AND updated_by = (SELECT auth.uid()));

CREATE FUNCTION public.admin_setup_team_season(p_club_id uuid, p_name text, p_age_group text, p_season_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team uuid; v_season uuid; v_ts uuid; v_name text := btrim(p_name);
  v_age text := upper(btrim(p_age_group)); v_season_name text := btrim(p_season_name);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF NOT public.club_is_operable(p_club_id) THEN RAISE EXCEPTION 'Verein nicht operativ'; END IF;
  IF coalesce(v_name,'')='' OR coalesce(v_age,'')='' OR coalesce(v_season_name,'')='' THEN RAISE EXCEPTION 'Name, Altersklasse und Saison erforderlich'; END IF;
  -- Serialize same-club setup retries. No existing season is rewritten.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_club_id::text, 0));
  SELECT ts.team_id, ts.id INTO v_team, v_ts
  FROM public.teams t JOIN public.team_seasons ts ON ts.team_id=t.id
    JOIN public.seasons s ON s.id=ts.season_id
  WHERE t.club_id=p_club_id AND lower(btrim(t.name))=lower(v_name)
    AND upper(btrim(coalesce(ts.age_group,t.age_group,'')))=v_age
    AND btrim(s.name)=v_season_name AND ts.status IN ('active','draft')
  ORDER BY ts.created_at LIMIT 1;
  IF v_ts IS NOT NULL THEN RETURN jsonb_build_object('status','exists','team_id',v_team,'team_season_id',v_ts); END IF;
  SELECT id INTO v_season FROM public.seasons WHERE btrim(name)=v_season_name ORDER BY created_at LIMIT 1;
  IF v_season IS NULL THEN INSERT INTO public.seasons(name) VALUES(v_season_name) RETURNING id INTO v_season; END IF;
  INSERT INTO public.teams(club_id,name,age_group) VALUES(p_club_id,v_name,v_age) RETURNING id INTO v_team;
  INSERT INTO public.team_seasons(team_id,season_id,status,age_group)
    VALUES(v_team,v_season,'active',v_age) RETURNING id INTO v_ts;
  RETURN jsonb_build_object('status','created','team_id',v_team,'team_season_id',v_ts);
END $$;

CREATE FUNCTION public.admin_team_setup_snapshot(p_team_season_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  WITH roster AS (
    SELECT p.id, coalesce(sp.jersey_number,p.jersey_number,p.number) AS jersey
    FROM public.players p LEFT JOIN public.team_season_players sp
      ON sp.player_id=p.id AND sp.team_season_id=p_team_season_id
    WHERE (sp.id IS NOT NULL AND coalesce(sp.is_active,true) AND sp.left_at IS NULL)
      OR (p.team_season_id=p_team_season_id AND sp.id IS NULL AND coalesce(p.is_active,true))
  ), access AS (
    SELECT DISTINCT r.id FROM roster r WHERE EXISTS(SELECT 1 FROM public.player_guardians g WHERE g.player_id=r.id)
      OR EXISTS(SELECT 1 FROM public.parent_link_invites i WHERE i.player_id=r.id AND i.team_season_id=p_team_season_id
        AND i.revoked_at IS NULL AND (i.used_at IS NOT NULL OR i.expires_at>now()))
  ) SELECT jsonb_build_object(
    'club_ready', c.status='active' AND nullif(btrim(c.name),'') IS NOT NULL
      AND nullif(c.logo_url,'') IS NOT NULL AND c.primary_color IS NOT NULL AND c.secondary_color IS NOT NULL,
    'team_ready', nullif(btrim(t.name),'') IS NOT NULL AND c.status='active',
    'season_ready', ts.status='active' AND nullif(btrim(s.name),'') IS NOT NULL AND nullif(btrim(ts.age_group),'') IS NOT NULL,
    'staff', (SELECT count(*) FROM public.memberships m WHERE m.team_season_id=ts.id AND m.role::text IN ('trainer','co_trainer','head_coach','head')),
    'players', (SELECT count(*) FROM roster),
    'jerseys_missing', (SELECT count(*) FROM roster WHERE jersey IS NULL),
    'access', (SELECT count(*) FROM access),
    'venues', (SELECT count(*) FROM public.team_season_training_venues v WHERE v.team_season_id=ts.id AND v.is_active
      AND (v.valid_from IS NULL OR v.valid_from<=now()) AND (v.valid_until IS NULL OR v.valid_until>now())),
    'matches', (SELECT count(*) FROM public.events e WHERE e.team_season_id=ts.id AND coalesce(e.kind,e.type)::text='match' AND coalesce(e.status::text,'') NOT IN ('cancelled','canceled')),
    'trainings', (SELECT count(*) FROM public.events e WHERE e.team_season_id=ts.id AND coalesce(e.kind,e.type)::text='training' AND coalesce(e.status::text,'') NOT IN ('cancelled','canceled')),
    'checks', coalesce(pr.checks,'{}'::jsonb), 'updated_at', pr.updated_at
  ) INTO v_result FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
    JOIN public.clubs c ON c.id=t.club_id JOIN public.seasons s ON s.id=ts.season_id
    LEFT JOIN public.manager_setup_progress pr ON pr.team_season_id=ts.id
    WHERE ts.id=p_team_season_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Mannschaftssaison nicht gefunden'; END IF;
  RETURN v_result;
END $$;

CREATE FUNCTION public.admin_save_setup_check(p_team_season_id uuid,p_step text,p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_step NOT IN ('club','team','season','staff','roster','access','venues','matches','training','review')
    OR p_step IS NULL OR p_value IS NULL OR p_value NOT IN ('reviewed','open','unneeded') THEN RAISE EXCEPTION 'Ungültiger Schritt'; END IF;
  IF p_value='unneeded' AND p_step NOT IN ('access','matches','training') THEN RAISE EXCEPTION 'Pflichtschritt kann nicht übersprungen werden'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
    JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=p_team_season_id AND c.status='active' AND ts.status='active')
    THEN RAISE EXCEPTION 'Nur aktive Mannschaftssaisons können eingerichtet werden'; END IF;
  INSERT INTO public.manager_setup_progress(team_season_id,checks,updated_by)
    VALUES(p_team_season_id,jsonb_build_object(p_step,p_value),auth.uid())
    ON CONFLICT(team_season_id) DO UPDATE SET checks=manager_setup_progress.checks || excluded.checks,
      updated_at=now(),updated_by=auth.uid();
  RETURN public.admin_team_setup_snapshot(p_team_season_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_setup_team_season(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_team_setup_snapshot(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_save_setup_check(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_setup_team_season(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_team_setup_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_setup_check(uuid,text,text) TO authenticated;
