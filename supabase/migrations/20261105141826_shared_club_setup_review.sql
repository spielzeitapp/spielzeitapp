-- Club branding is shared; team/season checks remain independent.
CREATE TABLE public.manager_club_setup_progress (
  club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  reviewed_signature jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX manager_club_setup_progress_updated_by_idx ON public.manager_club_setup_progress(updated_by);
ALTER TABLE public.manager_club_setup_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_club_setup_progress FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.manager_club_setup_progress TO authenticated;
CREATE POLICY club_setup_admin_select ON public.manager_club_setup_progress FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()));
CREATE POLICY club_setup_admin_insert ON public.manager_club_setup_progress FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()) AND updated_by=(SELECT auth.uid()));
CREATE POLICY club_setup_admin_update ON public.manager_club_setup_progress FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()) AND updated_by=(SELECT auth.uid()));

-- Same effective defaults and color normalization as clubBranding.ts.
-- A subsequent branding change invalidates the shared confirmation.
CREATE FUNCTION public.manager_club_setup_signature(c public.clubs)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT jsonb_build_object('name',btrim(c.name),'logo',btrim(c.logo_url),
    'primary',CASE WHEN btrim(c.primary_color) ~* '^#[0-9a-f]{6}$' THEN upper(btrim(c.primary_color)) ELSE '#111114' END,
    'secondary',CASE WHEN btrim(c.secondary_color) ~* '^#[0-9a-f]{6}$' THEN upper(btrim(c.secondary_color)) ELSE '#FFFFFF' END,
    'accent',CASE WHEN btrim(c.accent_color) ~* '^#[0-9a-f]{6}$' THEN upper(btrim(c.accent_color)) ELSE '#C82333' END);
$$;
REVOKE ALL ON FUNCTION public.manager_club_setup_signature(public.clubs) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_team_setup_snapshot(p_team_season_id uuid)
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
    'club_ready', c.status='active' AND nullif(btrim(c.name),'') IS NOT NULL AND nullif(btrim(c.logo_url),'') IS NOT NULL,
    'club_name', c.name,
    'club_missing', to_jsonb(array_remove(ARRAY[
      CASE WHEN c.status<>'active' THEN 'Verein ist archiviert' END,
      CASE WHEN nullif(btrim(c.name),'') IS NULL THEN 'Vereinsname' END,
      CASE WHEN nullif(btrim(c.logo_url),'') IS NULL THEN 'Vereinslogo' END
    ],NULL)),
    'club_uses_default_colors', NOT (coalesce(c.primary_color,'') ~* '^#[0-9a-f]{6}$' AND coalesce(c.secondary_color,'') ~* '^#[0-9a-f]{6}$' AND coalesce(c.accent_color,'') ~* '^#[0-9a-f]{6}$'),
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
    'checks', coalesce(pr.checks,'{}'::jsonb) || jsonb_build_object('club',
      CASE WHEN cp.reviewed_signature = public.manager_club_setup_signature(c) THEN 'reviewed' ELSE 'open' END),
    'updated_at', greatest(pr.updated_at,cp.updated_at)
  ) INTO v_result FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
    JOIN public.clubs c ON c.id=t.club_id JOIN public.seasons s ON s.id=ts.season_id
    LEFT JOIN public.manager_setup_progress pr ON pr.team_season_id=ts.id
    LEFT JOIN public.manager_club_setup_progress cp ON cp.club_id=c.id
    WHERE ts.id=p_team_season_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Mannschaftssaison nicht gefunden'; END IF;
  RETURN v_result;
END $$;


CREATE OR REPLACE FUNCTION public.admin_save_setup_check(p_team_season_id uuid,p_step text,p_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club public.clubs; v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_step NOT IN ('club','team','season','staff','roster','access','venues','matches','training','review')
    OR p_step IS NULL OR p_value IS NULL OR p_value NOT IN ('reviewed','open','unneeded') THEN RAISE EXCEPTION 'Ungültiger Schritt'; END IF;
  IF p_value='unneeded' AND p_step NOT IN ('access','matches','training') THEN RAISE EXCEPTION 'Pflichtschritt kann nicht übersprungen werden'; END IF;
  SELECT c.* INTO v_club FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id
    JOIN public.clubs c ON c.id=t.club_id WHERE ts.id=p_team_season_id AND c.status='active'
      AND (p_step='club' OR ts.status='active') FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nur aktive Vereine bzw. Mannschaftssaisons können eingerichtet werden'; END IF;
  IF p_step='club' THEN
    v_snapshot := public.admin_team_setup_snapshot(p_team_season_id);
    IF p_value='reviewed' AND NOT (v_snapshot->>'club_ready')::boolean THEN
      RAISE EXCEPTION 'Vereinsdaten fehlen: %', v_snapshot->'club_missing';
    END IF;
    INSERT INTO public.manager_club_setup_progress(club_id,reviewed_signature,updated_by)
      VALUES(v_club.id,CASE WHEN p_value='reviewed' THEN public.manager_club_setup_signature(v_club) END,auth.uid())
      ON CONFLICT(club_id) DO UPDATE SET reviewed_signature=excluded.reviewed_signature,updated_at=now(),updated_by=auth.uid();
    RETURN public.admin_team_setup_snapshot(p_team_season_id);
  END IF;
  INSERT INTO public.manager_setup_progress(team_season_id,checks,updated_by)
    VALUES(p_team_season_id,jsonb_build_object(p_step,p_value),auth.uid())
    ON CONFLICT(team_season_id) DO UPDATE SET checks=manager_setup_progress.checks || excluded.checks,
      updated_at=now(),updated_by=auth.uid();
  RETURN public.admin_team_setup_snapshot(p_team_season_id);
END $$;
