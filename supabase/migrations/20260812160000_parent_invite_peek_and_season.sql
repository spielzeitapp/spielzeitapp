-- PARENT-INVITE.1: peek invite email (token-bound, no child data) + season in preview label
-- Staging only. Does not change signup/recovery mailer templates.

-- ---------------------------------------------------------------------------
-- 1) peek_parent_link_invite — token holders may learn bound email only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peek_parent_link_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token text := lower(trim(coalesce(p_token, '')));
  v_token_hash text;
  v_row public.parent_link_invites%ROWTYPE;
BEGIN
  IF v_token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.parent_link_invites
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  -- No child / team / season. Email only when bound (personal invite).
  IF v_row.recipient_email IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'ready',
      'recipient_email', NULL,
      'recipient_email_masked', NULL,
      'expires_at', v_row.expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'ready',
    'recipient_email', v_row.recipient_email,
    'recipient_email_masked', public.mask_parent_invite_email(v_row.recipient_email),
    'expires_at', v_row.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.peek_parent_link_invite(text) IS
  'Token peek: status + optional recipient_email. No child/team data. Knowing the token is required.';

REVOKE ALL ON FUNCTION public.peek_parent_link_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_parent_link_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.peek_parent_link_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) preview_parent_link_invite — include season name in team_label
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_parent_link_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text := lower(trim(coalesce(p_token, '')));
  v_token_hash text;
  v_row public.parent_link_invites%ROWTYPE;
  v_auth_email text;
  v_confirmed timestamptz;
  v_display text;
  v_team_label text;
  v_season_label text;
BEGIN
  IF v_token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'needs_auth');
  END IF;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.parent_link_invites
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    IF v_row.used_by_user_id = v_uid THEN
      RETURN jsonb_build_object('status', 'already_linked');
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
    'player_id', v_row.player_id,
    'team_season_id', v_row.team_season_id,
    'player_display_name', v_display,
    'team_label', v_team_label,
    'season_label', v_season_label,
    'expires_at', v_row.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.preview_parent_link_invite(text) IS
  'Authenticated preview. Child data only when invite email matches verified auth email (or code invite).';

REVOKE ALL ON FUNCTION public.preview_parent_link_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_parent_link_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_parent_link_invite(text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
