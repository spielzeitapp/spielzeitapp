-- PARENT-INVITE.1F: Email-bound invite recovery when plain token was lost
-- (GoTrue redirect / login without stash / metadata missing for existing users).
-- Authenticated user must match recipient_email with verified email.

CREATE OR REPLACE FUNCTION public.has_open_parent_email_invite_for_me()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_confirmed timestamptz;
  v_invite_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated', 'has_open', false);
  END IF;

  SELECT lower(trim(u.email)), u.email_confirmed_at
  INTO v_auth_email, v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_auth_email IS NULL OR length(v_auth_email) = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'has_open', false);
  END IF;

  IF v_confirmed IS NULL THEN
    RETURN jsonb_build_object('status', 'email_not_verified', 'has_open', false);
  END IF;

  SELECT i.id
  INTO v_invite_id
  FROM public.parent_link_invites i
  WHERE i.recipient_email = v_auth_email
    AND i.used_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'status', 'ok',
    'has_open', v_invite_id IS NOT NULL,
    'invite_id', v_invite_id
  );
END;
$$;

COMMENT ON FUNCTION public.has_open_parent_email_invite_for_me() IS
  'True when authenticated verified email has an open personal parent invite (no plain token needed).';

REVOKE ALL ON FUNCTION public.has_open_parent_email_invite_for_me() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_open_parent_email_invite_for_me() FROM anon;
GRANT EXECUTE ON FUNCTION public.has_open_parent_email_invite_for_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_open_parent_email_invite_for_me()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_confirmed timestamptz;
  v_row public.parent_link_invites%ROWTYPE;
  v_display text;
  v_team_label text;
  v_season_label text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'needs_auth');
  END IF;

  SELECT lower(trim(u.email)), u.email_confirmed_at
  INTO v_auth_email, v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_auth_email IS NULL OR length(v_auth_email) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_confirmed IS NULL THEN
    RETURN jsonb_build_object('status', 'email_not_verified');
  END IF;

  SELECT * INTO v_row
  FROM public.parent_link_invites i
  WHERE i.recipient_email = v_auth_email
    AND i.used_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Distinguish expired/used vs never invited
    IF EXISTS (
      SELECT 1 FROM public.parent_link_invites i
      WHERE i.recipient_email = v_auth_email
        AND i.used_at IS NOT NULL
        AND i.used_by_user_id = v_uid
    ) THEN
      RETURN jsonb_build_object('status', 'already_linked');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.parent_link_invites i
      WHERE i.recipient_email = v_auth_email AND i.revoked_at IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('status', 'revoked');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.parent_link_invites i
      WHERE i.recipient_email = v_auth_email
        AND i.expires_at <= now()
        AND i.used_at IS NULL
        AND i.revoked_at IS NULL
    ) THEN
      RETURN jsonb_build_object('status', 'expired');
    END IF;
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  SELECT NULLIF(
    trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))),
    ''
  )
  INTO v_display
  FROM public.players p
  WHERE p.id = v_row.player_id;

  SELECT
    trim(
      coalesce(
        nullif(trim(ts.display_name), ''),
        nullif(trim(concat_ws(' ', nullif(trim(ts.age_group), ''), nullif(trim(t.name), ''))), ''),
        nullif(trim(t.name), ''),
        'Mannschaft'
      )
    ),
    nullif(trim(s.name), '')
  INTO v_team_label, v_season_label
  FROM public.team_seasons ts
  LEFT JOIN public.teams t ON t.id = ts.team_id
  LEFT JOIN public.seasons s ON s.id = ts.season_id
  WHERE ts.id = v_row.team_season_id;

  RETURN jsonb_build_object(
    'status', 'ready',
    'invite_id', v_row.id,
    'player_id', v_row.player_id,
    'team_season_id', v_row.team_season_id,
    'player_display_name', v_display,
    'team_label', v_team_label,
    'season_label', v_season_label,
    'expires_at', v_row.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.preview_open_parent_email_invite_for_me() IS
  'Preview open personal invite for authenticated verified email (no plain token).';

REVOKE ALL ON FUNCTION public.preview_open_parent_email_invite_for_me() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_open_parent_email_invite_for_me() FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_open_parent_email_invite_for_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_open_parent_email_invite_for_me()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_confirmed timestamptz;
  v_row public.parent_link_invites%ROWTYPE;
  v_display text;
  v_staff_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated');
  END IF;

  SELECT lower(trim(u.email)), u.email_confirmed_at
  INTO v_auth_email, v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_auth_email IS NULL OR length(v_auth_email) = 0 THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_confirmed IS NULL THEN
    RETURN jsonb_build_object('status', 'email_not_verified');
  END IF;

  SELECT * INTO v_row
  FROM public.parent_link_invites i
  WHERE i.recipient_email = v_auth_email
    AND i.used_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
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

COMMENT ON FUNCTION public.redeem_open_parent_email_invite_for_me() IS
  'Redeem newest open personal invite for authenticated verified email (no plain token).';

REVOKE ALL ON FUNCTION public.redeem_open_parent_email_invite_for_me() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_open_parent_email_invite_for_me() FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_open_parent_email_invite_for_me() TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
