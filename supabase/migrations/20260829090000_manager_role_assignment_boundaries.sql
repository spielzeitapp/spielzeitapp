-- MANAGER-RECHTE.2: Vereinsadmin getrennt von Teamrollen.
-- Plattformadmins bestimmen Vereinsadmins; Vereinsadmins bestimmen Trainer im eigenen Verein.

CREATE TABLE IF NOT EXISTS public.club_admin_assignments (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_admin_assignments_user_active
  ON public.club_admin_assignments (user_id, is_active, club_id);

COMMENT ON TABLE public.club_admin_assignments IS
  'Vereinsweite Adminrechte, bewusst getrennt von memberships.role und Trainerrollen.';

-- Bestehende Test-Zuordnungen aus dem alten memberships.role=admin-Modell verlustfrei übernehmen.
INSERT INTO public.club_admin_assignments (club_id, user_id, assigned_by, is_active)
SELECT DISTINCT t.club_id, m.user_id, NULL::uuid, true
FROM public.memberships m
JOIN public.team_seasons ts ON ts.id = m.team_season_id
JOIN public.teams t ON t.id = ts.team_id
WHERE lower(m.role::text) = 'admin'
ON CONFLICT (club_id, user_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

ALTER TABLE public.club_admin_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_admin_assignments_read_authorized ON public.club_admin_assignments;
CREATE POLICY club_admin_assignments_read_authorized
  ON public.club_admin_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin() OR user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.club_admin_assignments FROM authenticated;
GRANT SELECT ON public.club_admin_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.is_club_admin_for_club(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_club_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.club_admin_assignments ca
      WHERE ca.club_id = p_club_id
        AND ca.user_id = auth.uid()
        AND ca.is_active
    );
$$;

REVOKE ALL ON FUNCTION public.is_club_admin_for_club(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_admin_for_club(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_list_my_club_admin_team_seasons()
RETURNS TABLE (
  club_id uuid,
  team_season_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ca.club_id, ts.id
  FROM public.club_admin_assignments ca
  JOIN public.teams t ON t.club_id = ca.club_id
  JOIN public.team_seasons ts ON ts.team_id = t.id
  WHERE ca.user_id = auth.uid()
    AND ca.is_active
    AND lower(coalesce(ts.status::text, 'active')) <> 'archived'
  ORDER BY ca.club_id, ts.id;
$$;

REVOKE ALL ON FUNCTION public.manager_list_my_club_admin_team_seasons() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_list_my_club_admin_team_seasons() TO authenticated;

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

  SELECT u.id, u.email INTO v_id, v_auth_email
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

REVOKE ALL ON FUNCTION public.admin_lookup_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user_by_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_lookup_staff_user_by_email(
  p_team_season_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_club_id uuid;
  v_id uuid;
  v_auth_email text;
  v_first text;
  v_last text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;

  SELECT t.club_id INTO v_club_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_season_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Mannschaftssaison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_platform_admin() AND NOT public.is_club_admin_for_club(v_club_id) THEN
    RAISE EXCEPTION 'Nur Vereinsadmin des eigenen Vereins' USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Bitte eine gültige E-Mail angeben' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.email INTO v_id, v_auth_email
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT p.first_name, p.last_name
  INTO v_first, v_last
  FROM public.profiles p
  WHERE p.id = v_id;

  RETURN jsonb_build_object(
    'status', 'found',
    'user_id', v_id,
    'email', v_auth_email,
    'first_name', v_first,
    'last_name', v_last
  );
END;
$$;

REVOKE ALL ON FUNCTION public.manager_lookup_staff_user_by_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_lookup_staff_user_by_email(uuid, text) TO authenticated;

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
  v_was_active boolean := false;
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
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Benutzer nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT ca.is_active INTO v_was_active
  FROM public.club_admin_assignments ca
  WHERE ca.club_id = p_club_id AND ca.user_id = p_user_id;

  INSERT INTO public.club_admin_assignments
    (club_id, user_id, assigned_by, is_active, updated_at)
  VALUES
    (p_club_id, p_user_id, auth.uid(), true, now())
  ON CONFLICT (club_id, user_id) DO UPDATE SET
    assigned_by = auth.uid(),
    is_active = true,
    updated_at = now();

  INSERT INTO public.platform_admin_audit_log
    (admin_user_id, club_id, action, entity_type, entity_id, old_data, new_data)
  VALUES
    (auth.uid(), p_club_id, 'club_admin_assigned', 'club_admin_assignment', p_user_id::text,
     jsonb_build_object('is_active', coalesce(v_was_active, false)),
     jsonb_build_object('is_active', true, 'user_id', p_user_id));

  RETURN jsonb_build_object(
    'status', CASE WHEN v_was_active THEN 'exists' ELSE 'assigned' END,
    'club_id', p_club_id,
    'user_id', p_user_id,
    'role', 'club_admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_club_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_club_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_team_season_staff(
  p_team_season_id uuid,
  p_user_id uuid,
  p_role text DEFAULT 'head_coach'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(nullif(btrim(coalesce(p_role, 'head_coach')), ''));
  v_existing text;
  v_club_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
  END IF;
  IF p_team_season_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Pflichtfelder fehlen' USING ERRCODE = '22023';
  END IF;
  IF v_role NOT IN ('trainer', 'co_trainer', 'head_coach') THEN
    RAISE EXCEPTION 'Ungültige Trainerrolle' USING ERRCODE = '22023';
  END IF;

  SELECT t.club_id INTO v_club_id
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = p_team_season_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Mannschaftssaison nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_platform_admin() AND NOT public.is_club_admin_for_club(v_club_id) THEN
    RAISE EXCEPTION 'Nur Vereinsadmin des eigenen Vereins' USING ERRCODE = '42501';
  END IF;
  IF NOT public.club_is_operable(v_club_id) THEN
    RAISE EXCEPTION 'Verein nicht operativ' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Benutzer nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT lower(m.role::text) INTO v_existing
  FROM public.memberships m
  WHERE m.user_id = p_user_id
    AND m.team_season_id = p_team_season_id
  LIMIT 1;

  IF v_existing IN ('player', 'parent', 'fan', 'admin') THEN
    RAISE EXCEPTION 'Bestehende Spieler-, Eltern-, Fan- oder Legacy-Adminrolle wird nicht überschrieben'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_existing IS NULL THEN
    INSERT INTO public.memberships (user_id, team_season_id, role)
    VALUES (p_user_id, p_team_season_id, v_role::public.membership_role);
    v_status := 'created';
  ELSIF v_existing = v_role THEN
    v_status := 'exists';
  ELSE
    UPDATE public.memberships
    SET role = v_role::public.membership_role
    WHERE user_id = p_user_id
      AND team_season_id = p_team_season_id;
    v_status := 'updated';
  END IF;

  INSERT INTO public.platform_admin_audit_log
    (admin_user_id, club_id, action, entity_type, entity_id, old_data, new_data)
  VALUES
    (auth.uid(), v_club_id, 'team_staff_assigned', 'membership', p_user_id::text,
     jsonb_build_object('team_season_id', p_team_season_id, 'role', v_existing),
     jsonb_build_object('team_season_id', p_team_season_id, 'role', v_role));

  RETURN jsonb_build_object(
    'status', v_status,
    'club_id', v_club_id,
    'team_season_id', p_team_season_id,
    'user_id', p_user_id,
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_team_season_staff(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_team_season_staff(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_team_season_training_venues(p_team_season_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.team_seasons ts
      JOIN public.teams t ON t.id = ts.team_id
      WHERE ts.id = p_team_season_id
        AND public.is_club_admin_for_club(t.club_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_club_venues(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (public.is_platform_admin() OR public.is_club_admin_for_club(p_club_id))
    AND public.club_is_operable(p_club_id);
$$;

SELECT pg_notify('pgrst', 'reload schema');
