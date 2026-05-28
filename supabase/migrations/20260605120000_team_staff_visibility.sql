-- Team-Staff (Trainer) für alle Mitglieder einer Saison sichtbar + Kontaktfelder auf profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.phone IS 'Öffentliche Team-Kontaktnummer (Trainer/Staff).';
COMMENT ON COLUMN public.profiles.email IS 'Öffentliche Team-Kontakt-E-Mail (Trainer/Staff).';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Profilfoto-URL (Trainer/Staff).';

-- memberships: Mitglieder derselben team_season dürfen alle Zeilen lesen (Trainer-Tab).
DROP POLICY IF EXISTS memberships_select_own ON public.memberships;

CREATE POLICY memberships_select_team_season ON public.memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS mine
      WHERE mine.user_id = auth.uid()
        AND mine.team_season_id = memberships.team_season_id
    )
  );

-- profiles: Team-Kollegen lesen (für Trainer-Namen/Kontakt).
DROP POLICY IF EXISTS profiles_select_team_peers ON public.profiles;

CREATE POLICY profiles_select_team_peers ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS mine
      JOIN public.memberships AS peer ON peer.team_season_id = mine.team_season_id
      WHERE mine.user_id = auth.uid()
        AND peer.user_id = profiles.id
    )
  );

-- Staff darf Trainer-Profile im eigenen Team pflegen.
DROP POLICY IF EXISTS profiles_update_team_staff ON public.profiles;

CREATE POLICY profiles_update_team_staff ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS mgr
      JOIN public.memberships AS target ON target.team_season_id = mgr.team_season_id
      WHERE mgr.user_id = auth.uid()
        AND target.user_id = profiles.id
        AND lower(mgr.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
        AND lower(target.role::text) IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS mgr
      JOIN public.memberships AS target ON target.team_season_id = mgr.team_season_id
      WHERE mgr.user_id = auth.uid()
        AND target.user_id = profiles.id
        AND lower(mgr.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
        AND lower(target.role::text) IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM auth.users AS u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;

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
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.memberships AS mgr
    WHERE mgr.user_id = auth.uid()
      AND mgr.team_season_id = p_team_season_id
      AND lower(mgr.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF v_role NOT IN ('trainer', 'co_trainer', 'head_coach') THEN
    RAISE EXCEPTION 'invalid staff role';
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

REVOKE ALL ON FUNCTION public.upsert_team_staff_member(uuid, uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_team_staff_member(uuid, uuid, text, text, text, text, text, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
