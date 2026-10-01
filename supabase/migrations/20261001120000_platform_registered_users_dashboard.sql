-- Registrierte Auth-Konten getrennt von Nutzern mit Teamzuordnung zählen.
-- Nur die bestehende, auf Plattformadmins begrenzte RPC gibt den Aggregatwert frei.
CREATE OR REPLACE FUNCTION public.admin_get_platform_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'active_clubs', count(*) FILTER (WHERE c.status = 'active'),
    'archived_clubs', count(*) FILTER (WHERE c.status = 'archived'),
    'teams', (SELECT count(*) FROM public.teams),
    'active_seasons', (
      SELECT count(*) FROM public.team_seasons ts
      WHERE lower(coalesce(ts.status::text, '')) = 'active'
    ),
    'users', (SELECT count(DISTINCT ms.user_id) FROM public.memberships ms),
    'registered_users', (SELECT count(*) FROM auth.users),
    'active_players', (
      SELECT count(DISTINCT tsp.player_id)
      FROM public.team_season_players tsp
      WHERE tsp.is_active = true AND tsp.status = 'active'
    ),
    'clubs_without_active_season', (
      SELECT count(*)
      FROM public.clubs cx
      WHERE cx.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.teams t
          JOIN public.team_seasons ts ON ts.team_id = t.id
          WHERE t.club_id = cx.id AND lower(coalesce(ts.status::text, '')) = 'active'
        )
    )
  ) INTO v_result
  FROM public.clubs c;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_platform_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_dashboard() TO authenticated;
