-- Staging: Self-Service Eltern-Onboarding (Verein → Mannschaft → Saison → Kind).
-- Authentifizierte Eltern; minimale Felder; serverseitige Guardian-Verknüpfung.
-- Ersetzt nicht redeem_parent_link_invite / E-Mail-Einladungen; alte list_parent_link_* bleiben gesperrt.

-- ---------------------------------------------------------------------------
-- 1) list_parent_onboarding_clubs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_onboarding_clubs()
RETURNS TABLE (
  id uuid,
  name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    trim(coalesce(nullif(trim(c.name), ''), 'Verein')) AS name
  FROM public.clubs AS c
  WHERE public.club_is_operable(c.id)
    AND EXISTS (
      SELECT 1
      FROM public.teams AS t
      INNER JOIN public.team_seasons AS ts ON ts.team_id = t.id
      WHERE t.club_id = c.id
        AND lower(coalesce(ts.status, 'active')) = 'active'
    )
  ORDER BY name ASC;
$$;

COMMENT ON FUNCTION public.list_parent_onboarding_clubs() IS
  'Eltern-Onboarding: operative Vereine mit mindestens einer active Saison.';

REVOKE ALL ON FUNCTION public.list_parent_onboarding_clubs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_onboarding_clubs() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_parent_onboarding_clubs() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) list_parent_onboarding_teams
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_onboarding_teams(p_club_id uuid)
RETURNS TABLE (
  id uuid,
  label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    trim(
      coalesce(
        nullif(trim(t.name), ''),
        'Mannschaft'
      )
    ) AS label
  FROM public.teams AS t
  WHERE t.club_id = p_club_id
    AND public.club_is_operable(p_club_id)
    AND EXISTS (
      SELECT 1
      FROM public.team_seasons AS ts
      WHERE ts.team_id = t.id
        AND lower(coalesce(ts.status, 'active')) = 'active'
    )
  ORDER BY label ASC, t.created_at DESC;
$$;

COMMENT ON FUNCTION public.list_parent_onboarding_teams(uuid) IS
  'Eltern-Onboarding: Mannschaften eines Vereins mit active Saison.';

REVOKE ALL ON FUNCTION public.list_parent_onboarding_teams(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_onboarding_teams(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_parent_onboarding_teams(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) list_parent_onboarding_seasons — nur active
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_onboarding_seasons(p_team_id uuid)
RETURNS TABLE (
  id uuid,
  label text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id,
    trim(
      coalesce(
        nullif(trim(ts.display_name), ''),
        nullif(
          trim(
            concat_ws(
              ' · ',
              nullif(
                trim(
                  concat_ws(
                    ' ',
                    nullif(trim(ts.age_group), ''),
                    nullif(trim(t.name), '')
                  )
                ),
                ''
              ),
              nullif(trim(s.name), '')
            )
          ),
          ''
        ),
        nullif(trim(s.name), ''),
        'Saison'
      )
    ) AS label,
    ts.status
  FROM public.team_seasons AS ts
  INNER JOIN public.teams AS t ON t.id = ts.team_id
  LEFT JOIN public.seasons AS s ON s.id = ts.season_id
  WHERE ts.team_id = p_team_id
    AND lower(coalesce(ts.status, 'active')) = 'active'
    AND public.club_is_operable(t.club_id)
  ORDER BY ts.created_at DESC, label ASC;
$$;

COMMENT ON FUNCTION public.list_parent_onboarding_seasons(uuid) IS
  'Eltern-Onboarding: nur active Saisons einer Mannschaft.';

REVOKE ALL ON FUNCTION public.list_parent_onboarding_seasons(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_onboarding_seasons(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_parent_onboarding_seasons(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) list_parent_onboarding_roster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_onboarding_roster(p_team_season_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  jersey_number integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    trim(
      concat_ws(
        ' ',
        nullif(trim(p.first_name), ''),
        nullif(trim(p.last_name), '')
      )
    ) AS display_name,
    p.jersey_number
  FROM public.team_season_players AS tsp
  INNER JOIN public.players AS p ON p.id = tsp.player_id
  INNER JOIN public.team_seasons AS ts ON ts.id = tsp.team_season_id
  INNER JOIN public.teams AS t ON t.id = ts.team_id
  WHERE tsp.team_season_id = p_team_season_id
    AND auth.uid() IS NOT NULL
    AND lower(coalesce(ts.status, 'active')) = 'active'
    AND public.club_is_operable(t.club_id)
    AND tsp.left_at IS NULL
    AND lower(coalesce(tsp.status, 'active')) = 'active'
    AND coalesce(tsp.is_active, true) = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.player_guardians AS pg
      WHERE pg.player_id = p.id
        AND pg.user_id = auth.uid()
    )
  ORDER BY p.jersey_number ASC NULLS LAST, p.last_name ASC, p.first_name ASC;
$$;

COMMENT ON FUNCTION public.list_parent_onboarding_roster(uuid) IS
  'Eltern-Onboarding: aktiver Kader, ohne bereits verknüpfte Kinder des Aufrufers.';

REVOKE ALL ON FUNCTION public.list_parent_onboarding_roster(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_onboarding_roster(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_parent_onboarding_roster(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) link_parent_self_service
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_parent_self_service(
  p_team_season_id uuid,
  p_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_display text;
  v_staff_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated');
  END IF;

  IF p_team_season_id IS NULL OR p_player_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_seasons AS ts
    INNER JOIN public.teams AS t ON t.id = ts.team_id
    WHERE ts.id = p_team_season_id
      AND lower(coalesce(ts.status, 'active')) = 'active'
      AND public.club_is_operable(t.club_id)
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF NOT public.player_on_team_season_roster(p_team_season_id, p_player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_guardians AS pg
    WHERE pg.player_id = p_player_id
      AND pg.user_id = v_uid
  ) THEN
    SELECT NULLIF(
      trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))),
      ''
    )
    INTO v_display
    FROM public.players AS p
    WHERE p.id = p_player_id;

    RETURN jsonb_build_object(
      'status', 'already_linked',
      'player_id', p_player_id,
      'team_season_id', p_team_season_id,
      'player_display_name', v_display
    );
  END IF;

  INSERT INTO public.player_guardians (player_id, user_id)
  VALUES (p_player_id, v_uid);

  SELECT lower(trim(m.role))
  INTO v_staff_role
  FROM public.memberships AS m
  WHERE m.user_id = v_uid
    AND m.team_season_id = p_team_season_id
  LIMIT 1;

  IF v_staff_role IS NULL THEN
    INSERT INTO public.memberships (user_id, team_season_id, role)
    VALUES (v_uid, p_team_season_id, 'parent')
    ON CONFLICT (user_id, team_season_id) DO NOTHING;
  ELSIF v_staff_role NOT IN (
    'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff'
  ) THEN
    UPDATE public.memberships
    SET role = 'parent'
    WHERE user_id = v_uid
      AND team_season_id = p_team_season_id
      AND lower(trim(role)) NOT IN (
        'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff'
      );
  END IF;

  SELECT NULLIF(
    trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))),
    ''
  )
  INTO v_display
  FROM public.players AS p
  WHERE p.id = p_player_id;

  RETURN jsonb_build_object(
    'status', 'linked',
    'player_id', p_player_id,
    'team_season_id', p_team_season_id,
    'player_display_name', v_display
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'already_linked',
      'player_id', p_player_id,
      'team_season_id', p_team_season_id
    );
END;
$$;

COMMENT ON FUNCTION public.link_parent_self_service(uuid, uuid) IS
  'Authenticated parent links to roster player via server-side guardian insert.';

REVOKE ALL ON FUNCTION public.link_parent_self_service(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_parent_self_service(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.link_parent_self_service(uuid, uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
