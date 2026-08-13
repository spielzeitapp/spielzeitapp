-- Parent email invitations: bind invite to recipient email, preview, mark sent.
-- Follow-up to 20260811160000. Does not rewrite prior migrations.
-- No guardian backfills, no U11 history changes, no player_access reuse.

-- ---------------------------------------------------------------------------
-- 1) Extend parent_link_invites
-- ---------------------------------------------------------------------------
ALTER TABLE public.parent_link_invites
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

COMMENT ON COLUMN public.parent_link_invites.recipient_email IS
  'Normalized invited parent email. When set, redeem requires matching verified auth email.';

CREATE INDEX IF NOT EXISTS idx_parent_link_invites_recipient_email
  ON public.parent_link_invites (recipient_email)
  WHERE recipient_email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_parent_invite_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(lower(trim(coalesce(p_email, ''))), '');
$$;

CREATE OR REPLACE FUNCTION public.mask_parent_invite_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := public.normalize_parent_invite_email(p_email);
  v_local text;
  v_domain text;
BEGIN
  IF v IS NULL OR position('@' in v) = 0 THEN
    RETURN NULL;
  END IF;
  v_local := split_part(v, '@', 1);
  v_domain := split_part(v, '@', 2);
  IF length(v_local) <= 1 THEN
    RETURN '*@' || v_domain;
  END IF;
  RETURN substr(v_local, 1, 1) || '***@' || v_domain;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_parent_invite_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mask_parent_invite_email(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2) create_parent_link_invite — optional recipient email
--    On email invite: revoke prior open invites for same player+email, then create.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_parent_link_invite(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.create_parent_link_invite(uuid, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.create_parent_link_invite(
  p_team_season_id uuid,
  p_player_id uuid,
  p_expires_hours integer DEFAULT 72,
  p_recipient_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hours integer := greatest(1, least(coalesce(p_expires_hours, 72), 336));
  v_email text := public.normalize_parent_invite_email(p_recipient_email);
  v_token_plain text;
  v_token_hash text;
  v_invite_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated');
  END IF;

  IF p_team_season_id IS NULL OR p_player_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF NOT public.player_on_team_season_roster(p_team_season_id, p_player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  IF p_recipient_email IS NOT NULL AND (
    v_email IS NULL
    OR position('@' in v_email) = 0
    OR length(v_email) < 5
    OR length(v_email) > 254
  ) THEN
    RETURN jsonb_build_object('status', 'invalid_email');
  END IF;

  -- Resend/email path: supersede previous open invites for same player + email
  IF v_email IS NOT NULL THEN
    UPDATE public.parent_link_invites
    SET revoked_at = now()
    WHERE player_id = p_player_id
      AND team_season_id = p_team_season_id
      AND recipient_email = v_email
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now();
  END IF;

  v_token_plain := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(hours => v_hours);

  INSERT INTO public.parent_link_invites (
    player_id,
    team_season_id,
    token_hash,
    created_by_user_id,
    expires_at,
    recipient_email
  )
  VALUES (
    p_player_id,
    p_team_season_id,
    v_token_hash,
    v_uid,
    v_expires_at,
    v_email
  )
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'invite_id', v_invite_id,
    'token_plain', v_token_plain,
    'expires_at', v_expires_at,
    'player_id', p_player_id,
    'team_season_id', p_team_season_id,
    'recipient_email', v_email,
    'recipient_email_masked', public.mask_parent_invite_email(v_email),
    'channel', CASE WHEN v_email IS NULL THEN 'code' ELSE 'email' END
  );
END;
$$;

COMMENT ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer, text) IS
  'Staff-only: create one-time parent invite. Optional recipient_email binds redeem to verified auth email.';

REVOKE ALL ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) mark_parent_link_invite_sent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_parent_link_invite_sent(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.parent_link_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated');
  END IF;

  IF p_invite_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;

  SELECT * INTO v_row FROM public.parent_link_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT public.can_manage_team_staff(v_row.team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_row.used_at IS NOT NULL OR v_row.revoked_at IS NOT NULL OR v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'not_open');
  END IF;

  UPDATE public.parent_link_invites
  SET emailed_at = coalesce(emailed_at, now()),
      last_sent_at = now()
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'status', 'marked',
    'invite_id', p_invite_id,
    'recipient_email_masked', public.mask_parent_invite_email(v_row.recipient_email)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_parent_link_invite_sent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_parent_link_invite_sent(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_parent_link_invite_sent(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) list_parent_link_invites_for_player — include masked email + sent times
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_link_invites_for_player(
  p_team_season_id uuid,
  p_player_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated', 'invites', '[]'::jsonb);
  END IF;

  IF p_team_season_id IS NULL OR p_player_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input', 'invites', '[]'::jsonb);
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden', 'invites', '[]'::jsonb);
  END IF;

  IF NOT public.player_on_team_season_roster(p_team_season_id, p_player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team', 'invites', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'invites',
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'created_at', i.created_at,
            'expires_at', i.expires_at,
            'revoked_at', i.revoked_at,
            'used_at', i.used_at,
            'emailed_at', i.emailed_at,
            'last_sent_at', i.last_sent_at,
            'recipient_email_masked', public.mask_parent_invite_email(i.recipient_email),
            'channel', CASE WHEN i.recipient_email IS NULL THEN 'code' ELSE 'email' END,
            'state',
              CASE
                WHEN i.used_at IS NOT NULL THEN 'used'
                WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                WHEN i.expires_at <= now() THEN 'expired'
                ELSE 'open'
              END
          )
          ORDER BY i.created_at DESC
        )
        FROM public.parent_link_invites i
        WHERE i.player_id = p_player_id
          AND i.team_season_id = p_team_season_id
      ),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) preview_parent_link_invite — no child data until email matches
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
      -- Do not reveal child/team
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

  SELECT trim(
    coalesce(
      nullif(trim(ts.display_name), ''),
      nullif(trim(concat_ws(' ', nullif(trim(ts.age_group), ''), nullif(trim(t.name), ''))), ''),
      nullif(trim(t.name), ''),
      'Mannschaft'
    )
  )
  INTO v_team_label
  FROM public.team_seasons ts
  LEFT JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = v_row.team_season_id;

  RETURN jsonb_build_object(
    'status', 'ready',
    'player_id', v_row.player_id,
    'team_season_id', v_row.team_season_id,
    'player_display_name', v_display,
    'team_label', v_team_label,
    'expires_at', v_row.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.preview_parent_link_invite(text) IS
  'Authenticated preview. Child data only when invite email matches verified auth email (or code invite).';

REVOKE ALL ON FUNCTION public.preview_parent_link_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_parent_link_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_parent_link_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) redeem_parent_link_invite — enforce verified email match when bound
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

  SELECT lower(trim(m.role))
  INTO v_staff_role
  FROM public.memberships m
  WHERE m.user_id = v_uid AND m.team_season_id = v_row.team_season_id
  LIMIT 1;

  IF v_staff_role IS NULL THEN
    INSERT INTO public.memberships (user_id, team_season_id, role)
    VALUES (v_uid, v_row.team_season_id, 'parent')
    ON CONFLICT (user_id, team_season_id) DO NOTHING;
  ELSIF v_staff_role NOT IN (
    'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff'
  ) THEN
    UPDATE public.memberships
    SET role = 'parent'
    WHERE user_id = v_uid
      AND team_season_id = v_row.team_season_id
      AND lower(trim(role)) NOT IN (
        'trainer', 'coach', 'assistant', 'cotrainer', 'co_trainer', 'admin', 'club_admin', 'staff'
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

REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_parent_link_invite(text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
