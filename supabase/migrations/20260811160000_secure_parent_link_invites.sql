-- Secure parent linking: one-time trainer invites + lock down open parent roster RPCs.
-- Follow-up to 20260811120000 (already applied on Staging). Does not rewrite that migration.
-- No guardian backfills, no U11 history changes, no player_access reuse.

-- ---------------------------------------------------------------------------
-- 1) Lock down previously open parent-link list RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_parent_link_team_seasons()
RETURNS TABLE (
  id uuid,
  team_id uuid,
  label text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'parent_link_roster_listing_disabled'
    USING ERRCODE = '42501',
          HINT = 'Use trainer email link or redeem_parent_link_invite';
END;
$$;

CREATE OR REPLACE FUNCTION public.list_parent_link_roster(p_team_season_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  jersey_number integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'parent_link_roster_listing_disabled'
    USING ERRCODE = '42501',
          HINT = 'Use trainer email link or redeem_parent_link_invite';
END;
$$;

REVOKE ALL ON FUNCTION public.list_parent_link_team_seasons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_link_team_seasons() FROM anon;
REVOKE ALL ON FUNCTION public.list_parent_link_team_seasons() FROM authenticated;
REVOKE ALL ON FUNCTION public.list_parent_link_roster(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_link_roster(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.list_parent_link_roster(uuid) FROM authenticated;

COMMENT ON FUNCTION public.list_parent_link_team_seasons() IS
  'Disabled: open season listing for parents is not allowed.';
COMMENT ON FUNCTION public.list_parent_link_roster(uuid) IS
  'Disabled: open roster listing for parents is not allowed.';

-- ---------------------------------------------------------------------------
-- 2) Close client self-claim inserts on player_guardians
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_guardians_insert_own ON public.player_guardians;
DROP POLICY IF EXISTS player_guardians_insert_authenticated ON public.player_guardians;
DROP POLICY IF EXISTS "allow insert player_guardians" ON public.player_guardians;

-- ---------------------------------------------------------------------------
-- 3) parent_link_invites (separate from player_access_invites)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_link_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players (id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  used_at timestamptz NULL,
  used_by_user_id uuid NULL,
  CONSTRAINT parent_link_invites_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT parent_link_invites_expires_after_created CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_parent_link_invites_player_id
  ON public.parent_link_invites (player_id);

CREATE INDEX IF NOT EXISTS idx_parent_link_invites_team_season
  ON public.parent_link_invites (team_season_id);

CREATE INDEX IF NOT EXISTS idx_parent_link_invites_created_by
  ON public.parent_link_invites (created_by_user_id);

COMMENT ON TABLE public.parent_link_invites IS
  'One-time parent guardian invite codes. Token stored as SHA-256 hash only. Separate from player login/QR access.';

ALTER TABLE public.parent_link_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_link_invites_select_staff ON public.parent_link_invites;
CREATE POLICY parent_link_invites_select_staff ON public.parent_link_invites
  FOR SELECT
  TO authenticated
  USING (public.can_manage_team_staff(team_season_id));

-- No INSERT/UPDATE/DELETE policies for clients — only SECURITY DEFINER RPCs.

REVOKE ALL ON TABLE public.parent_link_invites FROM PUBLIC;
REVOKE ALL ON TABLE public.parent_link_invites FROM anon;
GRANT SELECT ON TABLE public.parent_link_invites TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) create_parent_link_invite — staff only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_parent_link_invite(
  p_team_season_id uuid,
  p_player_id uuid,
  p_expires_hours integer DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hours integer := greatest(1, least(coalesce(p_expires_hours, 72), 336));
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

  v_token_plain := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');
  v_expires_at := now() + make_interval(hours => v_hours);

  INSERT INTO public.parent_link_invites (
    player_id,
    team_season_id,
    token_hash,
    created_by_user_id,
    expires_at
  )
  VALUES (
    p_player_id,
    p_team_season_id,
    v_token_hash,
    v_uid,
    v_expires_at
  )
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'invite_id', v_invite_id,
    'token_plain', v_token_plain,
    'expires_at', v_expires_at,
    'player_id', p_player_id,
    'team_season_id', p_team_season_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer) IS
  'Staff-only: create one-time parent invite code. Plain token returned once; DB stores hash only.';

REVOKE ALL ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_parent_link_invite(uuid, uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) revoke_parent_link_invite — staff only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_parent_link_invite(p_invite_id uuid)
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

  SELECT *
  INTO v_row
  FROM public.parent_link_invites
  WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT public.can_manage_team_staff(v_row.team_season_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_revoked');
  END IF;

  UPDATE public.parent_link_invites
  SET revoked_at = now()
  WHERE id = p_invite_id
    AND revoked_at IS NULL
    AND used_at IS NULL;

  RETURN jsonb_build_object('status', 'revoked', 'invite_id', p_invite_id);
END;
$$;

COMMENT ON FUNCTION public.revoke_parent_link_invite(uuid) IS
  'Staff-only: revoke an unused parent invite.';

REVOKE ALL ON FUNCTION public.revoke_parent_link_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_parent_link_invite(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_parent_link_invite(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) list_parent_link_invites_for_player — staff only, no token
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

COMMENT ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) IS
  'Staff-only: invite status for one player. Never returns token or hash.';

REVOKE ALL ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_parent_link_invites_for_player(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) redeem_parent_link_invite — authenticated parent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_parent_link_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text := lower(trim(coalesce(p_token, '')));
  v_token_hash text;
  v_row public.parent_link_invites%ROWTYPE;
  v_display text;
  v_staff_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authenticated');
  END IF;

  -- Reject short / non-hex tokens without leaking invite existence
  IF v_token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  SELECT *
  INTO v_row
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
      -- Idempotent success for same parent
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

  IF NOT public.player_on_team_season_roster(v_row.team_season_id, v_row.player_id) THEN
    RETURN jsonb_build_object('status', 'player_not_in_team');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_guardians pg
    WHERE pg.player_id = v_row.player_id
      AND pg.user_id = v_uid
  ) THEN
    UPDATE public.parent_link_invites
    SET used_at = now(),
        used_by_user_id = v_uid
    WHERE id = v_row.id
      AND used_at IS NULL;

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
  SET used_at = now(),
      used_by_user_id = v_uid
  WHERE id = v_row.id
    AND used_at IS NULL;

  -- Parent membership on invite team season unless staff membership already exists
  SELECT lower(trim(m.role))
  INTO v_staff_role
  FROM public.memberships m
  WHERE m.user_id = v_uid
    AND m.team_season_id = v_row.team_season_id
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

COMMENT ON FUNCTION public.redeem_parent_link_invite(text) IS
  'Authenticated parent redeems one-time invite. Creates player_guardians only after server checks.';

REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_parent_link_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_parent_link_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) list_my_linked_children — only own guardians + minimal fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_linked_children()
RETURNS TABLE (
  player_id uuid,
  display_name text,
  team_season_id uuid,
  team_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS player_id,
    trim(
      concat_ws(
        ' ',
        nullif(trim(p.first_name), ''),
        nullif(trim(p.last_name), '')
      )
    ) AS display_name,
    tsp.team_season_id,
    trim(
      coalesce(
        nullif(trim(ts.display_name), ''),
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
        nullif(trim(t.name), ''),
        'Mannschaft'
      )
    ) AS team_label
  FROM public.player_guardians pg
  INNER JOIN public.players p ON p.id = pg.player_id
  LEFT JOIN LATERAL (
    SELECT tsp2.team_season_id
    FROM public.team_season_players tsp2
    INNER JOIN public.team_seasons ts2 ON ts2.id = tsp2.team_season_id
    WHERE tsp2.player_id = p.id
      AND tsp2.left_at IS NULL
      AND lower(coalesce(tsp2.status, 'active')) = 'active'
      AND coalesce(tsp2.is_active, true) = true
      AND lower(coalesce(ts2.status, 'active')) = 'active'
    ORDER BY ts2.created_at DESC NULLS LAST
    LIMIT 1
  ) tsp ON true
  LEFT JOIN public.team_seasons ts ON ts.id = tsp.team_season_id
  LEFT JOIN public.teams t ON t.id = ts.team_id
  WHERE pg.user_id = auth.uid()
  ORDER BY display_name ASC;
$$;

COMMENT ON FUNCTION public.list_my_linked_children() IS
  'Parent: only own linked children with current active season context. No foreign players.';

REVOKE ALL ON FUNCTION public.list_my_linked_children() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_linked_children() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_linked_children() TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
