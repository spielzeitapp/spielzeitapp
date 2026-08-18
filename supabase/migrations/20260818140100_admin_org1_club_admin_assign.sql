-- ADMIN-ORG.1 follow-up: club-admin assignment without team-season trainer role.
-- Does not grant platform admin. Reuses memberships.role = admin.

CREATE OR REPLACE FUNCTION public.admin_lookup_user_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_id uuid;
  v_auth_email text;
  v_first text;
  v_last text;
  v_is_platform boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Bitte eine gültige E-Mail angeben' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.email
  INTO v_id, v_auth_email
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT p.first_name, p.last_name, coalesce(p.is_admin, false)
  INTO v_first, v_last, v_is_platform
  FROM public.profiles p
  WHERE p.id = v_id;

  RETURN jsonb_build_object(
    'status', 'found',
    'user_id', v_id,
    'email', v_auth_email,
    'first_name', v_first,
    'last_name', v_last,
    'is_platform_admin', coalesce(v_is_platform, false)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_lookup_user_by_email(text) IS
  'Platform-admin-only user lookup by email. No hardcoded identities.';

REVOKE ALL ON FUNCTION public.admin_lookup_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user_by_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_club_admin(
  p_club_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts record;
  v_existing text;
  v_changed int := 0;
  v_already int := 0;
  v_season_count int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF p_club_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF NOT public.club_is_operable(p_club_id) THEN
    RAISE EXCEPTION 'Verein nicht operativ' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RAISE EXCEPTION 'Benutzer nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  FOR v_ts IN
    SELECT ts.id
    FROM public.team_seasons ts
    JOIN public.teams t ON t.id = ts.team_id
    WHERE t.club_id = p_club_id
      AND lower(coalesce(ts.status::text, '')) IN ('active', 'draft')
  LOOP
    v_season_count := v_season_count + 1;
    SELECT lower(m.role::text) INTO v_existing
    FROM public.memberships m
    WHERE m.user_id = p_user_id
      AND m.team_season_id = v_ts.id
    LIMIT 1;

    IF v_existing = 'admin' THEN
      v_already := v_already + 1;
      CONTINUE;
    END IF;
    IF v_existing IN ('player', 'parent') THEN
      CONTINUE;
    END IF;

    IF v_existing IS NULL THEN
      INSERT INTO public.memberships (user_id, team_season_id, role)
      VALUES (p_user_id, v_ts.id, 'admin'::public.membership_role);
    ELSE
      UPDATE public.memberships
      SET role = 'admin'::public.membership_role
      WHERE user_id = p_user_id
        AND team_season_id = v_ts.id;
    END IF;
    v_changed := v_changed + 1;
  END LOOP;

  IF v_season_count = 0 THEN
    RAISE EXCEPTION 'Keine operative Saison für diesen Verein' USING ERRCODE = 'P0001';
  END IF;

  IF v_changed = 0 AND v_already = 0 THEN
    RAISE EXCEPTION 'Benutzer ist auf den Saisons dieses Vereins als Spieler oder Eltern zugeordnet'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_changed = 0 THEN 'exists' ELSE 'assigned' END,
    'club_id', p_club_id,
    'user_id', p_user_id,
    'role', 'admin',
    'seasons_assigned', v_changed,
    'seasons_already', v_already
  );
END;
$$;

COMMENT ON FUNCTION public.admin_assign_club_admin(uuid, uuid) IS
  'Platform-admin-only club admin membership. Idempotent. Does not write user_roles or profiles.is_admin.';

REVOKE ALL ON FUNCTION public.admin_assign_club_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_club_admin(uuid, uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
