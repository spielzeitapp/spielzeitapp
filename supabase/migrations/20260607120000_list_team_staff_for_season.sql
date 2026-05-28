-- Trainer-Tab: Staff-Liste lesbar für alle Mitglieder derselben Saison (SECURITY DEFINER, kein RLS-Blindspot).

CREATE OR REPLACE FUNCTION public.list_team_staff_for_season(p_team_season_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  first_name text,
  last_name text,
  phone text,
  email text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.user_id,
    lower(trim(m.role::text)) AS role,
    p.first_name,
    p.last_name,
    p.phone,
    p.email,
    p.avatar_url
  FROM public.memberships AS m
  LEFT JOIN public.profiles AS p ON p.id = m.user_id
  WHERE m.team_season_id = p_team_season_id
    AND lower(trim(m.role::text)) IN ('trainer', 'co_trainer', 'head_coach')
    AND (
      public.is_admin()
      OR public.is_member_of_team_season(p_team_season_id)
    )
  ORDER BY
    CASE lower(trim(m.role::text))
      WHEN 'head_coach' THEN 0
      WHEN 'co_trainer' THEN 1
      WHEN 'trainer' THEN 2
      ELSE 9
    END,
    coalesce(p.last_name, ''),
    coalesce(p.first_name, '');
$$;

COMMENT ON FUNCTION public.list_team_staff_for_season(uuid) IS
  'Trainer/Co/Chef für team_season_id inkl. Profilfelder. SECURITY DEFINER für zuverlässige Team-Ansicht.';

REVOKE ALL ON FUNCTION public.list_team_staff_for_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_staff_for_season(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
