-- Trainer: Elternaccount per exakter E-Mail mit Spieler verknüpfen / entfernen.
-- Nutzt bestehende player_guardians (id, player_id, user_id + unique player_id+user_id).
-- Kein Bulk-Zugriff auf Benutzerlisten. SECURITY DEFINER mit Staff- und Kader-Check.
-- Ziel zuerst Staging; nicht ungefragt auf Production anwenden.

-- Unique (player_id, user_id) absichern (bereits typisch vorhanden)
CREATE UNIQUE INDEX IF NOT EXISTS player_guardians_player_id_user_id_key
  ON public.player_guardians (player_id, user_id);

-- ---------------------------------------------------------------------------
-- Hilfscheck: Spieler im aktiven Kader der Saison
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.player_on_team_season_roster(
  p_team_season_id uuid,
  p_player_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_team_season_id IS NOT NULL
    AND p_player_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_season_players AS tsp
      WHERE tsp.team_season_id = p_team_season_id
        AND tsp.player_id = p_player_id
        AND tsp.left_at IS NULL
        AND coalesce(tsp.status, 'active') <> 'archived'
    );
$$;

COMMENT ON FUNCTION public.player_on_team_season_roster(uuid, uuid) IS
  'True if player is on the current roster for the team season.';

REVOKE ALL ON FUNCTION public.player_on_team_season_roster(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_on_team_season_roster(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Lookup: exakte E-Mail → ein Account (nur Staff + Spieler im Team)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_parent_account_for_player_link(
  p_team_season_id uuid,
  p_player_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_display text;
  v_auth_email text;
BEGIN
  IF p_team_season_id IS NULL OR p_player_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF NOT public.player_on_team_season_roster(p_team_season_id, p_player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  IF v_email = '' OR position('@' in v_email) = 0 OR length(v_email) < 5 THEN
    RETURN jsonb_build_object('status', 'invalid_email');
  END IF;

  SELECT u.id, NULLIF(trim(u.email), '')
  INTO v_user_id, v_auth_email
  FROM auth.users AS u
  WHERE lower(trim(u.email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Keine Hinweise auf ähnliche Adressen
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT NULLIF(
    trim(
      coalesce(
        NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
        NULLIF(
          trim(
            concat_ws(
              ' ',
              u.raw_user_meta_data ->> 'first_name',
              u.raw_user_meta_data ->> 'last_name'
            )
          ),
          ''
        )
      )
    ),
    ''
  )
  INTO v_display
  FROM auth.users AS u
  LEFT JOIN public.profiles AS pr ON pr.id = u.id
  WHERE u.id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'found',
    'user_id', v_user_id,
    'display_name', v_display,
    'email', coalesce(v_auth_email, v_email)
  );
END;
$$;

COMMENT ON FUNCTION public.lookup_parent_account_for_player_link(uuid, uuid, text) IS
  'Staff-only exact email lookup for linking a parent account to a roster player.';

REVOKE ALL ON FUNCTION public.lookup_parent_account_for_player_link(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_parent_account_for_player_link(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Link
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_player_guardian(
  p_team_season_id uuid,
  p_player_id uuid,
  p_parent_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_display text;
BEGIN
  IF p_team_season_id IS NULL OR p_player_id IS NULL OR p_parent_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF NOT public.player_on_team_season_roster(p_team_season_id, p_player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_parent_user_id) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_guardians pg
    WHERE pg.player_id = p_player_id
      AND pg.user_id = p_parent_user_id
  ) THEN
    SELECT NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')
    INTO v_display
    FROM public.profiles pr
    WHERE pr.id = p_parent_user_id;

    RETURN jsonb_build_object(
      'status', 'already_linked',
      'user_id', p_parent_user_id,
      'display_name', v_display
    );
  END IF;

  INSERT INTO public.player_guardians (player_id, user_id)
  VALUES (p_player_id, p_parent_user_id);

  SELECT NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  INTO v_display
  FROM public.profiles pr
  WHERE pr.id = p_parent_user_id;

  RETURN jsonb_build_object(
    'status', 'linked',
    'user_id', p_parent_user_id,
    'display_name', v_display
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'already_linked',
      'user_id', p_parent_user_id
    );
END;
$$;

COMMENT ON FUNCTION public.link_player_guardian(uuid, uuid, uuid) IS
  'Staff-only: create player_guardians row for a roster player.';

REVOKE ALL ON FUNCTION public.link_player_guardian(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_player_guardian(uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Unlink (nur die eine Verknüpfung)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_player_guardian(
  p_team_season_id uuid,
  p_player_id uuid,
  p_parent_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int := 0;
  v_display text;
BEGIN
  IF p_team_season_id IS NULL OR p_player_id IS NULL OR p_parent_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF NOT public.player_on_team_season_roster(p_team_season_id, p_player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  SELECT NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  INTO v_display
  FROM public.profiles pr
  WHERE pr.id = p_parent_user_id;

  DELETE FROM public.player_guardians pg
  WHERE pg.player_id = p_player_id
    AND pg.user_id = p_parent_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('status', 'not_linked');
  END IF;

  RETURN jsonb_build_object(
    'status', 'unlinked',
    'user_id', p_parent_user_id,
    'display_name', v_display
  );
END;
$$;

COMMENT ON FUNCTION public.unlink_player_guardian(uuid, uuid, uuid) IS
  'Staff-only: delete one player_guardians row. Does not delete users/profiles/players.';

REVOKE ALL ON FUNCTION public.unlink_player_guardian(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_player_guardian(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
