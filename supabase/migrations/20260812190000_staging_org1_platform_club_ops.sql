-- STAGING-ORG.1: Platform-Admin Club Ops (Teams, Saisons, Staff, Venue-Grants)
-- Additive only. No venue duplication. No second rights architecture.

CREATE OR REPLACE FUNCTION public.admin_create_team(
  p_club_id uuid,
  p_name text,
  p_age_group text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_age text := nullif(btrim(coalesce(p_age_group, '')), '');
  v_id uuid;
  v_existing uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_club_id IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF NOT public.club_is_operable(p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht operativ' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id INTO v_existing
  FROM public.teams t
  WHERE t.club_id = p_club_id
    AND lower(btrim(t.name)) = lower(v_name)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'exists',
      'team_id', v_existing,
      'name', v_name
    );
  END IF;

  INSERT INTO public.teams (club_id, name, age_group)
  VALUES (p_club_id, v_name, v_age)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'team_id', v_id,
    'name', v_name,
    'age_group', v_age
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_team(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_team(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ensure_team_season(
  p_team_id uuid,
  p_season_name text,
  p_status text DEFAULT 'active',
  p_display_name text DEFAULT NULL,
  p_age_group text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_name text := nullif(btrim(coalesce(p_season_name, '')), '');
  v_status text := lower(nullif(btrim(coalesce(p_status, 'active')), ''));
  v_club_id uuid;
  v_season_id uuid;
  v_ts_id uuid;
  v_display text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_age text := nullif(btrim(coalesce(p_age_group, '')), '');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_team_id IS NULL OR v_season_name IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('active', 'draft') THEN
    RAISE EXCEPTION 'Ungültiger Saisonstatus' USING ERRCODE = '22023';
  END IF;

  SELECT t.club_id, coalesce(v_age, t.age_group)
  INTO v_club_id, v_age
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Mannschaft nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.club_is_operable(v_club_id) THEN
    RAISE EXCEPTION 'Verein nicht operativ' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.id INTO v_season_id
  FROM public.seasons s
  WHERE btrim(s.name) = v_season_name
  LIMIT 1;

  IF v_season_id IS NULL THEN
    INSERT INTO public.seasons (name)
    VALUES (v_season_name)
    RETURNING id INTO v_season_id;
  END IF;

  SELECT ts.id INTO v_ts_id
  FROM public.team_seasons ts
  WHERE ts.team_id = p_team_id
    AND ts.season_id = v_season_id
  LIMIT 1;

  IF v_ts_id IS NOT NULL THEN
    UPDATE public.team_seasons
    SET
      status = CASE WHEN status = 'archived' THEN v_status ELSE status END,
      display_name = coalesce(v_display, display_name),
      age_group = coalesce(v_age, age_group)
    WHERE id = v_ts_id;

    RETURN jsonb_build_object(
      'status', 'exists',
      'team_season_id', v_ts_id,
      'season_id', v_season_id,
      'season_name', v_season_name
    );
  END IF;

  INSERT INTO public.team_seasons (team_id, season_id, status, display_name, age_group)
  VALUES (p_team_id, v_season_id, v_status, v_display, v_age)
  RETURNING id INTO v_ts_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'team_season_id', v_ts_id,
    'season_id', v_season_id,
    'season_name', v_season_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ensure_team_season(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ensure_team_season(uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_team_season_staff(
  p_team_season_id uuid,
  p_user_id uuid,
  p_role text DEFAULT 'head_coach'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(nullif(btrim(coalesce(p_role, 'head_coach')), ''));
  v_existing text;
  v_club_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_team_season_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF v_role NOT IN ('trainer', 'co_trainer', 'head_coach', 'head') THEN
    RAISE EXCEPTION 'Ungültige Staff-Rolle' USING ERRCODE = '22023';
  END IF;

  SELECT t.club_id INTO v_club_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_season_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Saison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RAISE EXCEPTION 'Benutzer nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT lower(m.role::text) INTO v_existing
  FROM public.memberships m
  WHERE m.user_id = p_user_id
    AND m.team_season_id = p_team_season_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing = v_role THEN
      RETURN jsonb_build_object(
        'status', 'exists',
        'team_season_id', p_team_season_id,
        'user_id', p_user_id,
        'role', v_role
      );
    END IF;
    UPDATE public.memberships
    SET role = v_role::public.membership_role
    WHERE user_id = p_user_id
      AND team_season_id = p_team_season_id;
    RETURN jsonb_build_object(
      'status', 'updated',
      'team_season_id', p_team_season_id,
      'user_id', p_user_id,
      'role', v_role
    );
  END IF;

  INSERT INTO public.memberships (user_id, team_season_id, role)
  VALUES (p_user_id, p_team_season_id, v_role::public.membership_role);

  RETURN jsonb_build_object(
    'status', 'created',
    'team_season_id', p_team_season_id,
    'user_id', p_user_id,
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_team_season_staff(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_team_season_staff(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_team_season_venue_grant(
  p_team_season_id uuid,
  p_venue_id uuid,
  p_purpose text,
  p_is_active boolean DEFAULT true,
  p_sort_order integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purpose text := lower(nullif(btrim(coalesce(p_purpose, '')), ''));
  v_id uuid;
  v_owner uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_team_season_id IS NULL OR p_venue_id IS NULL OR v_purpose IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF v_purpose NOT IN ('training', 'home_match') THEN
    RAISE EXCEPTION 'Ungültiger Zweck' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_seasons WHERE id = p_team_season_id) THEN
    RAISE EXCEPTION 'Saison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT v.club_id INTO v_owner FROM public.venues v WHERE v.id = p_venue_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Anlage nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.team_season_training_venues (
    team_season_id, venue_id, purpose, is_active, sort_order
  )
  VALUES (
    p_team_season_id, p_venue_id, v_purpose, coalesce(p_is_active, true), coalesce(p_sort_order, 0)
  )
  ON CONFLICT (team_season_id, venue_id, purpose) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'grant_id', v_id,
    'team_season_id', p_team_season_id,
    'venue_id', p_venue_id,
    'purpose', v_purpose,
    'owner_club_id', v_owner,
    'is_active', coalesce(p_is_active, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_team_season_venue_grant(uuid, uuid, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_team_season_venue_grant(uuid, uuid, text, boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_grantable_venues()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'club_id', v.club_id,
          'club_name', c.name,
          'is_active', v.is_active
        )
        ORDER BY c.name, v.name
      )
      FROM public.venues v
      JOIN public.clubs c ON c.id = v.club_id
      WHERE coalesce(v.is_active, true)
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_grantable_venues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_grantable_venues() TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
