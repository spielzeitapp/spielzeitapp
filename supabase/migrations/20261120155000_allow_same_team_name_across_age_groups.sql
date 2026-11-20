-- Platform-admin metadata correction. No recreation of teams or team_seasons.
-- SECURITY DEFINER is needed for this narrow admin operation across RLS scopes;
-- authorization is checked before any row access and PUBLIC/anon cannot execute it.
CREATE OR REPLACE FUNCTION public.admin_update_team_details(
  p_club_id uuid, p_team_season_id uuid, p_name text, p_age_group text,
  p_season_name text, p_expected_name text, p_expected_age_group text,
  p_expected_season_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_team public.teams%rowtype;
  v_ts public.team_seasons%rowtype;
  v_name text := nullif(btrim(p_name), '');
  v_age text := nullif(btrim(p_age_group), '');
  v_season text := nullif(btrim(p_season_name), '');
  v_old_season text;
  v_season_id uuid;
  v_label_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_platform_admin(), false) THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL OR length(v_name) > 120 OR v_age IS NULL OR length(v_age) > 40
     OR v_season IS NULL OR v_season !~ '^20[0-9]{2}/[0-9]{2}$' THEN
    RAISE EXCEPTION 'Name, Altersklasse und Saison (z. B. 2026/27) prüfen.' USING ERRCODE = '22023';
  END IF;
  IF right(v_season, 2)::int <> (left(v_season, 4)::int + 1) % 100 THEN
    RAISE EXCEPTION 'Die Saison muss zwei aufeinanderfolgende Jahre enthalten.' USING ERRCODE = '22023';
  END IF;
  -- Share the club lock with admin_setup_team_season before locking the team.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_club_id::text, 0));
  SELECT t.* INTO v_team FROM public.teams t
    JOIN public.team_seasons ts ON ts.team_id = t.id
    WHERE ts.id = p_team_season_id AND t.club_id = p_club_id FOR UPDATE OF t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mannschaft gehört nicht zu diesem Verein.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ts FROM public.team_seasons WHERE id = p_team_season_id FOR UPDATE;
  SELECT name INTO v_old_season FROM public.seasons WHERE id = v_ts.season_id;
  IF NOT public.club_is_operable(p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht operativ.' USING ERRCODE = '22023';
  END IF;
  IF v_team.name IS DISTINCT FROM p_expected_name
     OR v_ts.age_group IS DISTINCT FROM p_expected_age_group
     OR v_old_season IS DISTINCT FROM p_expected_season_name THEN
    RAISE EXCEPTION 'Zwischenzeitlich geändert. Seite neu laden und erneut prüfen.' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.team_seasons own
    JOIN public.seasons own_year ON own_year.id = own.season_id
    JOIN public.teams other ON other.club_id = p_club_id AND other.id <> v_team.id
    JOIN public.team_seasons other_team_season ON other_team_season.team_id = other.id
    JOIN public.seasons other_year ON other_year.id = other_team_season.season_id
    WHERE own.team_id = v_team.id
      AND (own.id = v_ts.id OR lower(btrim(v_team.name)) <> lower(v_name))
      AND lower(btrim(other.name)) = lower(v_name)
      AND btrim(other_year.name) = CASE WHEN own.id = v_ts.id THEN v_season ELSE btrim(own_year.name) END
      AND upper(btrim(coalesce(other_team_season.age_group, other.age_group, '')))
          = upper(CASE WHEN own.id = v_ts.id THEN v_age ELSE btrim(coalesce(own.age_group, v_team.age_group, '')) END)
  ) THEN
    RAISE EXCEPTION 'In diesem Verein gibt es bereits eine Mannschaft mit diesem Namen, dieser Altersklasse und Saison.' USING ERRCODE = '23505';
  END IF;
  v_season_id := v_ts.season_id;
  IF v_season IS DISTINCT FROM v_old_season THEN
    -- Reuse a season record; never rename a shared season used by other teams.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('admin-edit-season:' || v_season));
    SELECT id INTO v_season_id FROM public.seasons WHERE name = v_season ORDER BY created_at, id LIMIT 1;
    IF v_season_id IS NULL THEN
      INSERT INTO public.seasons(name, active) VALUES(v_season, false) RETURNING id INTO v_season_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.team_seasons WHERE team_id = v_team.id
               AND season_id = v_season_id AND id <> v_ts.id) THEN
      RAISE EXCEPTION 'Für diese Mannschaft existiert die Zielsaison bereits.' USING ERRCODE = '23505';
    END IF;
  END IF;
  v_label_name := btrim(regexp_replace(v_name, '(^|[[:space:]])U[0-9]{1,2}[a-z]?$', '', 'i'));
  v_label_name := btrim(regexp_replace(v_label_name, '^U[0-9]{1,2}[a-z]?[[:space:]]+', '', 'i'));
  IF lower(right(v_label_name, length(v_age) + 1)) = lower(' ' || v_age) THEN
    v_label_name := btrim(left(v_label_name, length(v_label_name) - length(v_age) - 1));
  END IF;
  UPDATE public.teams SET name = v_name WHERE id = v_team.id;
  UPDATE public.team_seasons SET age_group = v_age, season_id = v_season_id,
    display_name = concat_ws(' · ', nullif(v_label_name, ''), v_age, v_season)
    WHERE id = v_ts.id;
  RETURN jsonb_build_object('team_id', v_team.id, 'team_season_id', v_ts.id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_team_details(uuid,uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_team_details(uuid,uuid,text,text,text,text,text,text) TO authenticated;
