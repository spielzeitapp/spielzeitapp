-- Staging: Minimale RPCs für Eltern-Kind-Verknüpfung ohne pauschale RLS-Lockerung.
-- Liefert nur Auswahlfelder für aktive Saisons und aktive Kader-Spieler.
-- Keine Kontakt-, Termin- oder Anwesenheitsdaten.

CREATE OR REPLACE FUNCTION public.list_parent_link_team_seasons()
RETURNS TABLE (
  id uuid,
  team_id uuid,
  label text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id,
    ts.team_id,
    trim(
      coalesce(
        nullif(trim(ts.display_name), ''),
        nullif(
          trim(
            concat_ws(
              ' ',
              nullif(trim(ts.age_group), ''),
              nullif(trim(t.name), '')
            )
          ),
          ''
        ),
        nullif(trim(t.name), ''),
        'Mannschaft'
      )
    ) AS label,
    ts.status
  FROM public.team_seasons AS ts
  LEFT JOIN public.teams AS t ON t.id = ts.team_id
  WHERE lower(coalesce(ts.status, 'active')) = 'active'
  ORDER BY label ASC, ts.created_at DESC;
$$;

COMMENT ON FUNCTION public.list_parent_link_team_seasons() IS
  'Eltern-Onboarding: nur active team_seasons mit minimalem Label (SECURITY DEFINER).';

CREATE OR REPLACE FUNCTION public.list_parent_link_roster(p_team_season_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  jersey_number integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    trim(
      concat_ws(
        ' ',
        nullif(trim(p.first_name), ''),
        nullif(trim(p.last_name), '')
      )
    ) AS display_name,
    p.jersey_number
  FROM public.team_season_players AS tsp
  INNER JOIN public.players AS p ON p.id = tsp.player_id
  WHERE tsp.team_season_id = p_team_season_id
    AND tsp.left_at IS NULL
    AND lower(coalesce(tsp.status, 'active')) = 'active'
    AND coalesce(tsp.is_active, true) = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.player_guardians AS pg
      WHERE pg.player_id = p.id
        AND pg.user_id = auth.uid()
    )
  ORDER BY p.jersey_number ASC NULLS LAST, p.last_name ASC, p.first_name ASC;
$$;

COMMENT ON FUNCTION public.list_parent_link_roster(uuid) IS
  'Eltern-Onboarding: aktiver Kader einer Saison, ohne bereits verknüpfte Kinder (SECURITY DEFINER).';

REVOKE ALL ON FUNCTION public.list_parent_link_team_seasons() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_parent_link_team_seasons() TO authenticated;

REVOKE ALL ON FUNCTION public.list_parent_link_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_parent_link_roster(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
