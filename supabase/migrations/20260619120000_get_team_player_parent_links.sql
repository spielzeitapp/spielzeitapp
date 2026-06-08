-- Trainer-Übersicht: Eltern-Verknüpfungen pro Kader-Spieler (SECURITY DEFINER).
-- Liest player_guardians + profiles nur für Staff des team_season_id.

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
SET search_path = public
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
          'name', coalesce(
            NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
            'Elternteil'
          ),
          'email', NULLIF(trim(pr.email), '')
        )
        ORDER BY pr.last_name NULLS LAST, pr.first_name NULLS LAST
      ) FILTER (WHERE pg.user_id IS NOT NULL),
      '[]'::jsonb
    ) AS parents
  FROM public.players AS p
  LEFT JOIN public.player_guardians AS pg ON pg.player_id = p.id
  LEFT JOIN public.profiles AS pr ON pr.id = pg.user_id
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
  'Eltern-Verknüpfungen je Kader-Spieler für Staff (trainer/co_trainer/head_coach/admin). profiles.email nur als Kontaktfeld.';

REVOKE ALL ON FUNCTION public.get_team_player_parent_links(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_player_parent_links(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
