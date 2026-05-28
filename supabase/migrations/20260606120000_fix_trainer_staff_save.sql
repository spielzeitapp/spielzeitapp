-- Trainer speichern: Account-Suche (auth.users) + Staff-Upsert ohne RLS-Falle bei Berechtigungsprüfung.

CREATE OR REPLACE FUNCTION public.can_manage_team_staff(p_team_season_id uuid)
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
      FROM public.memberships AS m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = p_team_season_id
        AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    );
$$;

COMMENT ON FUNCTION public.can_manage_team_staff(uuid) IS
  'True if auth.uid() may manage trainer staff for p_team_season_id. SECURITY DEFINER reads memberships without RLS issues.';

REVOKE ALL ON FUNCTION public.can_manage_team_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_team_staff(uuid) TO authenticated;

-- Nur auth.users.email (Konto); profiles.id = auth.users.id.
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM auth.users AS u
  WHERE lower(trim(coalesce(p_email, ''))) <> ''
    AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.find_user_id_by_email(text) IS
  'Resolves SpielzeitApp account user id from auth.users.email (not profiles.email contact field).';

CREATE OR REPLACE FUNCTION public.upsert_team_staff_member(
  p_team_season_id uuid,
  p_user_id uuid,
  p_role text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(trim(coalesce(p_role, '')));
BEGIN
  IF p_team_season_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing team_season_id or user_id';
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF v_role NOT IN ('trainer', 'co_trainer', 'head_coach') THEN
    RAISE EXCEPTION 'invalid staff role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'account not found';
  END IF;

  INSERT INTO public.memberships (user_id, team_season_id, role)
  VALUES (p_user_id, p_team_season_id, v_role::public.membership_role)
  ON CONFLICT (user_id, team_season_id)
  DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.profiles
  SET
    first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    email = COALESCE(NULLIF(trim(p_email), ''), email),
    avatar_url = COALESCE(NULLIF(trim(p_avatar_url), ''), avatar_url)
  WHERE id = p_user_id;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');
