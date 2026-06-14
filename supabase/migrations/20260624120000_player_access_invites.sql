-- U11 Spieler-QR-Zugang (Backend MVP, Step 1)
-- QR-Spieler: access_mode = view_only (kein Zu-/Absage, keine Trainer-/Elternrechte).
-- Token nur gehasht in DB; Einlösung über SECURITY DEFINER RPCs.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- player_users.access_mode
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_users'
      AND column_name = 'access_mode'
  ) THEN
    ALTER TABLE public.player_users
      ADD COLUMN access_mode text NOT NULL DEFAULT 'full';
  END IF;
END $$;

ALTER TABLE public.player_users
  DROP CONSTRAINT IF EXISTS player_users_access_mode_check;

ALTER TABLE public.player_users
  ADD CONSTRAINT player_users_access_mode_check
  CHECK (access_mode IN ('full', 'view_only'));

COMMENT ON COLUMN public.player_users.access_mode IS
  'full = Self-RSVP erlaubt; view_only = QR-U11-Spieler (nur Lesen, kein Zu-/Absage).';

-- view_only: kein direktes RSVP-Schreiben (auch nicht über Client-RLS)
DROP POLICY IF EXISTS event_attendance_insert_player ON public.event_attendance;
CREATE POLICY event_attendance_insert_player ON public.event_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      JOIN public.players p ON p.id = pu.player_id
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND p.team_season_id = e.team_season_id
        AND pu.access_mode = 'full'
    )
  );

DROP POLICY IF EXISTS event_attendance_update_player ON public.event_attendance;
CREATE POLICY event_attendance_update_player ON public.event_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      JOIN public.players p ON p.id = pu.player_id
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND p.team_season_id = e.team_season_id
        AND pu.access_mode = 'full'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.player_users pu
      JOIN public.players p ON p.id = pu.player_id
      JOIN public.events e ON e.id = event_attendance.event_id
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_attendance.player_id
        AND p.team_season_id = e.team_season_id
        AND pu.access_mode = 'full'
    )
  );

-- ---------------------------------------------------------------------------
-- player_access_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_access_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_kind text NOT NULL CHECK (created_by_kind IN ('parent', 'staff')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  redeemed_at timestamptz NULL,
  redeemed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  max_uses int NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count int NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_access_invites_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT player_access_invites_use_count_lte_max CHECK (use_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_player_access_invites_player_id
  ON public.player_access_invites (player_id);

CREATE INDEX IF NOT EXISTS idx_player_access_invites_created_by
  ON public.player_access_invites (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_player_access_invites_team_season
  ON public.player_access_invites (team_season_id);

COMMENT ON TABLE public.player_access_invites IS
  'Einmal-QR-/Link-Einladungen für U11-Spieler (view_only). Token nur als SHA-256-Hash.';

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_guardian_of_player(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.player_guardians pg
    WHERE pg.user_id = auth.uid()
      AND pg.player_id = p_player_id
  );
$$;

COMMENT ON FUNCTION public.is_guardian_of_player(uuid) IS
  'True if auth.uid() is linked to p_player_id via player_guardians.';

CREATE OR REPLACE FUNCTION public.is_staff_for_team_season(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = p_team_season_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    );
$$;

COMMENT ON FUNCTION public.is_staff_for_team_season(uuid) IS
  'True if auth.uid() is staff (or admin) for p_team_season_id.';

CREATE OR REPLACE FUNCTION public.can_manage_player_access_invite(p_invite_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.player_access_invites i
    WHERE i.id = p_invite_id
      AND (
        i.created_by_user_id = auth.uid()
        OR public.is_staff_for_team_season(i.team_season_id)
        OR public.is_guardian_of_player(i.player_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS player_access_invites
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_access_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_access_invites_select_authorized ON public.player_access_invites;
CREATE POLICY player_access_invites_select_authorized ON public.player_access_invites
  FOR SELECT TO authenticated
  USING (
    created_by_user_id = auth.uid()
    OR public.is_staff_for_team_season(team_season_id)
    OR public.is_guardian_of_player(player_id)
  );

-- Keine direkten Client-Inserts/Updates/Deletes — nur RPCs (SECURITY DEFINER).

-- ---------------------------------------------------------------------------
-- RPC: generate_player_access_invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_player_access_invite(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_player record;
  v_token_plain text;
  v_token_hash text;
  v_invite_id uuid;
  v_expires_at timestamptz;
  v_created_by_kind text;
  v_url_path text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT p.id, p.team_season_id
  INTO v_player
  FROM public.players p
  WHERE p.id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'player_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_guardian_of_player(p_player_id) THEN
    v_created_by_kind := 'parent';
  ELSIF public.is_staff_for_team_season(v_player.team_season_id) THEN
    v_created_by_kind := 'staff';
  ELSE
    RAISE EXCEPTION 'forbidden_not_guardian_or_staff' USING ERRCODE = '42501';
  END IF;

  -- URL-sicherer Token (48 hex Zeichen)
  v_token_plain := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := encode(extensions.digest(v_token_plain, 'sha256'), 'hex');
  v_expires_at := now() + interval '14 days';

  INSERT INTO public.player_access_invites (
    player_id,
    team_season_id,
    token_hash,
    created_by_user_id,
    created_by_kind,
    expires_at,
    max_uses,
    use_count
  )
  VALUES (
    p_player_id,
    v_player.team_season_id,
    v_token_hash,
    v_uid,
    v_created_by_kind,
    v_expires_at,
    1,
    0
  )
  RETURNING id INTO v_invite_id;

  v_url_path := '/app/player-access?t=' || v_token_plain;

  RETURN jsonb_build_object(
    'invite_id', v_invite_id,
    'token_plain', v_token_plain,
    'expires_at', v_expires_at,
    'url_path', v_url_path
  );
END;
$$;

COMMENT ON FUNCTION public.generate_player_access_invite(uuid) IS
  'Erzeugt QR/Link-Einladung für einen Kader-Spieler. Nur Guardian oder Staff. Token nur einmal im Return sichtbar.';

-- ---------------------------------------------------------------------------
-- RPC: revoke_player_access_invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_player_access_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_manage_player_access_invite(p_invite_id) THEN
    RAISE EXCEPTION 'forbidden_cannot_revoke_invite' USING ERRCODE = '42501';
  END IF;

  UPDATE public.player_access_invites
  SET revoked_at = now()
  WHERE id = p_invite_id
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found_or_already_revoked' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('invite_id', p_invite_id, 'revoked', true);
END;
$$;

COMMENT ON FUNCTION public.revoke_player_access_invite(uuid) IS
  'Widerruft eine Spieler-QR-Einladung. Ersteller, Guardian oder Staff.';

-- ---------------------------------------------------------------------------
-- RPC: redeem_player_access_invite
-- QR-Spieler = view_only; erzeugt nie player_guardians oder Staff-Rollen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_player_access_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_token_hash text;
  v_invite record;
  v_existing_role text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated_anonymous_sign_in_required'
      USING ERRCODE = '28000',
            HINT = 'Frontend muss zuerst supabase.auth.signInAnonymously() ausführen.';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = '22023';
  END IF;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  SELECT *
  INTO v_invite
  FROM public.player_access_invites i
  WHERE i.token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked' USING ERRCODE = '42501';
  END IF;

  IF v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = '42501';
  END IF;

  IF v_invite.use_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invite_already_used' USING ERRCODE = '42501';
  END IF;

  -- Nie Trainer/Admin/Eltern-Rolle überschreiben
  SELECT m.role::text
  INTO v_existing_role
  FROM public.memberships m
  WHERE m.user_id = v_uid
    AND m.team_season_id = v_invite.team_season_id;

  IF v_existing_role IN ('trainer', 'co_trainer', 'head_coach', 'parent') THEN
    RAISE EXCEPTION 'cannot_redeem_existing_role_%', v_existing_role USING ERRCODE = '42501';
  END IF;

  -- view_only Spieler-Verknüpfung (nie player_guardians)
  INSERT INTO public.player_users (user_id, player_id, access_mode)
  VALUES (v_uid, v_invite.player_id, 'view_only')
  ON CONFLICT (user_id, player_id)
  DO UPDATE SET access_mode = 'view_only';

  -- Nur player-Membership; nie trainer/admin/parent
  INSERT INTO public.memberships (user_id, team_season_id, role)
  VALUES (v_uid, v_invite.team_season_id, 'player'::public.membership_role)
  ON CONFLICT (user_id, team_season_id)
  DO UPDATE SET role = EXCLUDED.role
  WHERE public.memberships.role::text IN ('fan', 'player');

  UPDATE public.player_access_invites
  SET
    use_count = use_count + 1,
    redeemed_at = COALESCE(redeemed_at, now()),
    redeemed_by_user_id = COALESCE(redeemed_by_user_id, v_uid)
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'player_id', v_invite.player_id,
    'team_season_id', v_invite.team_season_id,
    'access_mode', 'view_only'
  );
END;
$$;

COMMENT ON FUNCTION public.redeem_player_access_invite(text) IS
  'Löst QR-Token ein: player_users (view_only) + memberships (player). Kein RSVP, keine Eltern-/Trainer-Rechte.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_guardian_of_player(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_for_team_season(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_player_access_invite(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_player_access_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_player_access_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_player_access_invite(text) TO authenticated;

GRANT SELECT ON public.player_access_invites TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
