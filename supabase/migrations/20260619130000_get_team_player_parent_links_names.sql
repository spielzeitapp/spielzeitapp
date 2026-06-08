-- Eltern-Verknüpfungen: Namen aus profiles (first/last, full_name, display_name) + E-Mail-Fallback.

CREATE OR REPLACE FUNCTION public.get_team_player_parent_links(p_team_season_id uuid)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  jersey_number integer,
  status text,
  is_active boolean,
  parent_count integer,
  parents jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_team_season_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_manage_team_staff(p_team_season_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS player_id,
    coalesce(
      NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Spieler'
    ) AS player_name,
    p.jersey_number,
    coalesce(p.status, 'active')::text AS status,
    coalesce(p.is_active, true) AS is_active,
    count(pg.user_id)::integer AS parent_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', pg.user_id,
          'first_name', pr.first_name,
          'last_name', pr.last_name,
          'full_name', NULLIF(trim(pr.full_name), ''),
          'display_name', coalesce(
            NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
            NULLIF(trim(pr.full_name), '')
          ),
          'name', coalesce(
            NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
            NULLIF(trim(pr.full_name), '')
          ),
          'email', coalesce(
            NULLIF(trim(pr.email), ''),
            NULLIF(trim(u.email), '')
          )
        )
        ORDER BY pr.last_name NULLS LAST, pr.first_name NULLS LAST
      ) FILTER (WHERE pg.user_id IS NOT NULL),
      '[]'::jsonb
    ) AS parents
  FROM public.players AS p
  LEFT JOIN public.player_guardians AS pg ON pg.player_id = p.id
  LEFT JOIN public.profiles AS pr ON pr.id = pg.user_id
  LEFT JOIN auth.users AS u ON u.id = pg.user_id
  WHERE p.team_season_id = p_team_season_id
    AND coalesce(p.status, 'active') <> 'archived'
  GROUP BY
    p.id,
    p.first_name,
    p.last_name,
    p.jersey_number,
    p.status,
    p.is_active
  ORDER BY
    p.jersey_number NULLS LAST,
    p.last_name NULLS LAST,
    p.first_name NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_team_player_parent_links(uuid) IS
  'Eltern-Verknüpfungen je Kader-Spieler. Namen aus profiles (first/last, full_name, display_name); E-Mail aus profiles oder auth.users.';

SELECT pg_notify('pgrst', 'reload schema');
