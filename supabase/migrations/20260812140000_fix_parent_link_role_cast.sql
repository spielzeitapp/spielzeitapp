-- PARENT-LINK.2: Fix link_parent_self_service / redeem_parent_link_invite
-- Root cause: memberships.role is enum membership_role; trim(m.role) fails
-- (function btrim(membership_role) does not exist) even when no rows match.
-- Staging only via apply script; idempotent CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1) link_parent_self_service
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_parent_self_service(
  p_team_season_id uuid,
  p_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

  -- Ensure profile row exists (safe upsert; no overwrite of existing names)
  INSERT INTO public.profiles (id, email, first_name, last_name, is_admin)
  SELECT
    u.id,
    nullif(trim(u.email), ''),
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'last_name', '')), ''),
    false
  FROM auth.users u
  WHERE u.id = v_uid
  ON CONFLICT (id) DO UPDATE
    SET email = coalesce(public.profiles.email, EXCLUDED.email),
        first_name = coalesce(nullif(trim(public.profiles.first_name), ''), EXCLUDED.first_name),
        last_name = coalesce(nullif(trim(public.profiles.last_name), ''), EXCLUDED.last_name);

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

    -- Idempotent: ensure parent membership exists
    INSERT INTO public.memberships (user_id, team_season_id, role)
    VALUES (v_uid, p_team_season_id, 'parent')
    ON CONFLICT (user_id, team_season_id) DO NOTHING;

    RETURN jsonb_build_object(
      'status', 'already_linked',
      'player_id', p_player_id,
      'team_season_id', p_team_season_id,
      'player_display_name', v_display
    );
  END IF;

  INSERT INTO public.player_guardians (player_id, user_id)
  VALUES (p_player_id, v_uid);

  SELECT lower(trim(m.role::text))
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
    'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff',
    'head_coach'
  ) THEN
    UPDATE public.memberships
    SET role = 'parent'
    WHERE user_id = v_uid
      AND team_season_id = p_team_season_id
      AND lower(trim(role::text)) NOT IN (
        'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff',
        'head_coach'
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
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', left(SQLERRM, 180)
    );
END;
$$;

COMMENT ON FUNCTION public.link_parent_self_service(uuid, uuid) IS
  'Authenticated parent links to roster player. Casts membership_role to text before trim.';

REVOKE ALL ON FUNCTION public.link_parent_self_service(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_parent_self_service(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.link_parent_self_service(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) redeem_parent_link_invite — same enum cast fix
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_parent_link_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text := lower(trim(coalesce(p_token, '')));
  v_token_hash text;
  v_row public.parent_link_invites%ROWTYPE;
  v_display text;
  v_staff_role text;
  v_auth_email text;
  v_confirmed timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated');
  END IF;

  IF v_token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.parent_link_invites
  WHERE token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    IF v_row.used_by_user_id = v_uid THEN
      SELECT NULLIF(
        trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))),
        ''
      )
      INTO v_display
      FROM public.players p
      WHERE p.id = v_row.player_id;

      RETURN jsonb_build_object(
        'status', 'already_linked',
        'player_id', v_row.player_id,
        'team_season_id', v_row.team_season_id,
        'player_display_name', v_display
      );
    END IF;
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT lower(trim(u.email)), u.email_confirmed_at
  INTO v_auth_email, v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_row.recipient_email IS NOT NULL THEN
    IF v_confirmed IS NULL THEN
      RETURN jsonb_build_object('status', 'email_not_verified');
    END IF;
    IF v_auth_email IS DISTINCT FROM v_row.recipient_email THEN
      RETURN jsonb_build_object(
        'status', 'email_mismatch',
        'expected_email_masked', public.mask_parent_invite_email(v_row.recipient_email)
      );
    END IF;
  END IF;

  IF NOT public.player_on_team_season_roster(v_row.team_season_id, v_row.player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_guardians pg
    WHERE pg.player_id = v_row.player_id AND pg.user_id = v_uid
  ) THEN
    UPDATE public.parent_link_invites
    SET used_at = now(), used_by_user_id = v_uid
    WHERE id = v_row.id AND used_at IS NULL;

    SELECT NULLIF(
      trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))),
      ''
    )
    INTO v_display
    FROM public.players p
    WHERE p.id = v_row.player_id;

    RETURN jsonb_build_object(
      'status', 'already_linked',
      'player_id', v_row.player_id,
      'team_season_id', v_row.team_season_id,
      'player_display_name', v_display
    );
  END IF;

  INSERT INTO public.player_guardians (player_id, user_id)
  VALUES (v_row.player_id, v_uid);

  UPDATE public.parent_link_invites
  SET used_at = now(), used_by_user_id = v_uid
  WHERE id = v_row.id AND used_at IS NULL;

  SELECT lower(trim(m.role::text))
  INTO v_staff_role
  FROM public.memberships m
  WHERE m.user_id = v_uid AND m.team_season_id = v_row.team_season_id
  LIMIT 1;

  IF v_staff_role IS NULL THEN
    INSERT INTO public.memberships (user_id, team_season_id, role)
    VALUES (v_uid, v_row.team_season_id, 'parent')
    ON CONFLICT (user_id, team_season_id) DO NOTHING;
  ELSIF v_staff_role NOT IN (
    'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff',
    'head_coach'
  ) THEN
    UPDATE public.memberships
    SET role = 'parent'
    WHERE user_id = v_uid
      AND team_season_id = v_row.team_season_id
      AND lower(trim(role::text)) NOT IN (
        'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff',
        'head_coach'
      );
  END IF;

  SELECT NULLIF(
    trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))),
    ''
  )
  INTO v_display
  FROM public.players p
  WHERE p.id = v_row.player_id;

  RETURN jsonb_build_object(
    'status', 'linked',
    'player_id', v_row.player_id,
    'team_season_id', v_row.team_season_id,
    'player_display_name', v_display
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'already_linked',
      'player_id', v_row.player_id,
      'team_season_id', v_row.team_season_id
    );
END;
$$;

COMMENT ON FUNCTION public.redeem_parent_link_invite(text) IS
  'Authenticated parent redeems invite. Casts membership_role to text before trim.';

REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_parent_link_invite(text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
