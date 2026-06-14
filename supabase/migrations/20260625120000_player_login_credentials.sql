-- U11 Spieler-Code + PIN Login (Step 5)
-- Eigene Tabelle; PIN nur als bcrypt-Hash. QR-Flow bleibt unverändert.

-- ---------------------------------------------------------------------------
-- player_login_credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_login_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  login_code text NOT NULL,
  pin_hash text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL,
  CONSTRAINT player_login_credentials_player_id_unique UNIQUE (player_id),
  CONSTRAINT player_login_credentials_login_code_unique UNIQUE (login_code),
  CONSTRAINT player_login_credentials_login_code_format CHECK (login_code ~ '^[A-Z0-9]{4,20}$')
);

CREATE INDEX IF NOT EXISTS idx_player_login_credentials_login_code
  ON public.player_login_credentials (login_code);

CREATE INDEX IF NOT EXISTS idx_player_login_credentials_team_season
  ON public.player_login_credentials (team_season_id);

COMMENT ON TABLE public.player_login_credentials IS
  'Dauerhafter Spieler-Code + PIN für view_only Login ohne E-Mail. PIN nur gehasht.';

-- ---------------------------------------------------------------------------
-- Helper: view_only session (shared by QR redeem + code login)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_view_only_player_session(
  p_uid uuid,
  p_player_id uuid,
  p_team_season_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_role text;
BEGIN
  SELECT m.role::text
  INTO v_existing_role
  FROM public.memberships m
  WHERE m.user_id = p_uid
    AND m.team_season_id = p_team_season_id;

  IF v_existing_role IN ('trainer', 'co_trainer', 'head_coach', 'parent') THEN
    RAISE EXCEPTION 'cannot_login_existing_role_%', v_existing_role USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.player_users (user_id, player_id, access_mode)
  VALUES (p_uid, p_player_id, 'view_only')
  ON CONFLICT (user_id, player_id)
  DO UPDATE SET access_mode = 'view_only';

  INSERT INTO public.memberships (user_id, team_season_id, role)
  VALUES (p_uid, p_team_season_id, 'player'::public.membership_role)
  ON CONFLICT (user_id, team_season_id)
  DO UPDATE SET role = EXCLUDED.role
  WHERE public.memberships.role::text IN ('fan', 'player');
END;
$$;

COMMENT ON FUNCTION public._apply_view_only_player_session(uuid, uuid, uuid) IS
  'Verknüpft auth.uid() als view_only-Spieler (intern für QR + Code/PIN).';

CREATE OR REPLACE FUNCTION public.can_manage_player_login(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_guardian_of_player(p_player_id)
    OR EXISTS (
      SELECT 1
      FROM public.players pl
      WHERE pl.id = p_player_id
        AND public.is_staff_for_team_season(pl.team_season_id)
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_login_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_login_credentials_select_authorized ON public.player_login_credentials;
CREATE POLICY player_login_credentials_select_authorized ON public.player_login_credentials
  FOR SELECT TO authenticated
  USING (public.can_manage_player_login(player_id));

-- Keine Client-Writes — nur RPCs.

-- ---------------------------------------------------------------------------
-- Internal: generate unique login code from player first name
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._generate_unique_login_code(p_player_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_base text;
  v_code text;
  v_attempt int := 0;
BEGIN
  SELECT p.first_name
  INTO v_first_name
  FROM public.players p
  WHERE p.id = p_player_id;

  v_base := upper(regexp_replace(coalesce(nullif(trim(v_first_name), ''), 'SPIELER'), '[^A-Za-z]', '', 'g'));
  IF length(v_base) < 2 THEN
    v_base := 'SPIELER';
  END IF;
  v_base := left(v_base, 12);

  LOOP
    v_attempt := v_attempt + 1;
    v_code := v_base || lpad((floor(random() * 100)::int)::text, 2, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.player_login_credentials c
      WHERE c.login_code = v_code
    );
    IF v_attempt >= 60 THEN
      RAISE EXCEPTION 'login_code_generation_failed' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public._generate_pin_plain()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lpad((floor(random() * 10000)::int)::text, 4, '0');
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_player_login_credentials_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_player_login_credentials_status(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_row record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_manage_player_login(p_player_id) THEN
    RAISE EXCEPTION 'forbidden_not_guardian_or_staff' USING ERRCODE = '42501';
  END IF;

  SELECT c.login_code, c.revoked_at, c.last_used_at, c.updated_at
  INTO v_row
  FROM public.player_login_credentials c
  WHERE c.player_id = p_player_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_credentials', false,
      'active', false,
      'login_code', null
    );
  END IF;

  RETURN jsonb_build_object(
    'has_credentials', true,
    'active', v_row.revoked_at IS NULL,
    'login_code', CASE WHEN v_row.revoked_at IS NULL THEN v_row.login_code ELSE null END,
    'last_used_at', v_row.last_used_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: generate_player_login_credentials
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_player_login_credentials(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_player record;
  v_login_code text;
  v_pin_plain text;
  v_pin_hash text;
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

  IF NOT public.can_manage_player_login(p_player_id) THEN
    RAISE EXCEPTION 'forbidden_not_guardian_or_staff' USING ERRCODE = '42501';
  END IF;

  v_login_code := public._generate_unique_login_code(p_player_id);
  v_pin_plain := public._generate_pin_plain();
  v_pin_hash := extensions.crypt(v_pin_plain, extensions.gen_salt('bf', 8));

  INSERT INTO public.player_login_credentials (
    player_id,
    team_season_id,
    login_code,
    pin_hash,
    created_by_user_id,
    revoked_at,
    updated_at
  )
  VALUES (
    p_player_id,
    v_player.team_season_id,
    v_login_code,
    v_pin_hash,
    v_uid,
    NULL,
    now()
  )
  ON CONFLICT (player_id)
  DO UPDATE SET
    login_code = EXCLUDED.login_code,
    pin_hash = EXCLUDED.pin_hash,
    team_season_id = EXCLUDED.team_season_id,
    created_by_user_id = EXCLUDED.created_by_user_id,
    revoked_at = NULL,
    updated_at = now(),
    last_used_at = NULL;

  RETURN jsonb_build_object(
    'player_id', p_player_id,
    'login_code', v_login_code,
    'pin_plain', v_pin_plain
  );
END;
$$;

COMMENT ON FUNCTION public.generate_player_login_credentials(uuid) IS
  'Erzeugt/erneuert Spieler-Code + PIN. Nur Guardian/Staff. PIN nur einmal im Return.';

-- ---------------------------------------------------------------------------
-- RPC: rotate_player_login_pin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_player_login_pin(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_pin_plain text;
  v_pin_hash text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_manage_player_login(p_player_id) THEN
    RAISE EXCEPTION 'forbidden_not_guardian_or_staff' USING ERRCODE = '42501';
  END IF;

  v_pin_plain := public._generate_pin_plain();
  v_pin_hash := extensions.crypt(v_pin_plain, extensions.gen_salt('bf', 8));

  UPDATE public.player_login_credentials
  SET
    pin_hash = v_pin_hash,
    updated_at = now()
  WHERE player_id = p_player_id
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'login_credentials_not_found_or_revoked' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'player_id', p_player_id,
    'pin_plain', v_pin_plain
  );
END;
$$;

COMMENT ON FUNCTION public.rotate_player_login_pin(uuid) IS
  'Neue PIN für bestehenden Spieler-Code. Alte PIN ungültig.';

-- ---------------------------------------------------------------------------
-- RPC: revoke_player_login
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_player_login(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_revoked_creds boolean := false;
  v_revoked_invites int := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_manage_player_login(p_player_id) THEN
    RAISE EXCEPTION 'forbidden_not_guardian_or_staff' USING ERRCODE = '42501';
  END IF;

  UPDATE public.player_login_credentials
  SET revoked_at = now(), updated_at = now()
  WHERE player_id = p_player_id
    AND revoked_at IS NULL;

  IF FOUND THEN
    v_revoked_creds := true;
  END IF;

  UPDATE public.player_access_invites
  SET revoked_at = now()
  WHERE player_id = p_player_id
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_revoked_invites = ROW_COUNT;

  IF NOT v_revoked_creds AND v_revoked_invites = 0 THEN
    RAISE EXCEPTION 'login_access_not_found_or_already_revoked' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'player_id', p_player_id,
    'revoked_credentials', v_revoked_creds,
    'revoked_invites', v_revoked_invites
  );
END;
$$;

COMMENT ON FUNCTION public.revoke_player_login(uuid) IS
  'Sperrt Code/PIN und alle offenen QR-Einladungen für den Spieler.';

-- ---------------------------------------------------------------------------
-- RPC: player_code_login
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.player_code_login(
  p_login_code text,
  p_pin_plain text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_code text;
  v_pin text;
  v_cred record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated_anonymous_sign_in_required'
      USING ERRCODE = '28000',
            HINT = 'Frontend muss zuerst supabase.auth.signInAnonymously() ausführen.';
  END IF;

  v_code := upper(trim(coalesce(p_login_code, '')));
  v_pin := trim(coalesce(p_pin_plain, ''));

  IF length(v_code) < 4 OR length(v_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_login_code_or_pin' USING ERRCODE = '22023';
  END IF;

  SELECT c.*
  INTO v_cred
  FROM public.player_login_credentials c
  WHERE c.login_code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'login_invalid_credentials' USING ERRCODE = '42501';
  END IF;

  IF v_cred.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'login_revoked' USING ERRCODE = '42501';
  END IF;

  IF v_cred.pin_hash IS DISTINCT FROM extensions.crypt(v_pin, v_cred.pin_hash) THEN
    RAISE EXCEPTION 'login_invalid_credentials' USING ERRCODE = '42501';
  END IF;

  PERFORM public._apply_view_only_player_session(
    v_uid,
    v_cred.player_id,
    v_cred.team_season_id
  );

  UPDATE public.player_login_credentials
  SET last_used_at = now(), updated_at = now()
  WHERE id = v_cred.id;

  RETURN jsonb_build_object(
    'player_id', v_cred.player_id,
    'team_season_id', v_cred.team_season_id,
    'access_mode', 'view_only'
  );
END;
$$;

COMMENT ON FUNCTION public.player_code_login(text, text) IS
  'Spieler-Login per Code + PIN: view_only player_users + memberships (player).';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._apply_view_only_player_session(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_player_login(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._generate_unique_login_code(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._generate_pin_plain() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_player_login_credentials_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_player_login_credentials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_player_login_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_player_login(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.player_code_login(text, text) TO authenticated;

GRANT SELECT ON public.player_login_credentials TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
