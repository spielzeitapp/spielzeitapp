-- STEP 4: Legacy vs Join Kader-Vergleich (Staging).
-- Unabhängig vom App-Feature-Flag.

WITH legacy AS (
  SELECT
    p.id AS player_id,
    p.team_season_id,
    p.jersey_number,
    nullif(trim(p.position), '') AS position,
    lower(coalesce(p.status, 'active')) AS status,
    coalesce(p.is_active, true) AS is_active,
    coalesce(p.is_laz_player, false) AS is_laz_player
  FROM public.players p
  WHERE p.team_season_id IS NOT NULL
),
join_rows AS (
  SELECT
    tsp.player_id,
    tsp.team_season_id,
    tsp.jersey_number,
    nullif(trim(tsp.position), '') AS position,
    lower(coalesce(tsp.status, 'active')) AS status,
    coalesce(tsp.is_active, true) AS is_active,
    coalesce(tsp.is_laz_player, false) AS is_laz_player
  FROM public.team_season_players tsp
),
per_season AS (
  SELECT
    coalesce(l.team_season_id, j.team_season_id) AS team_season_id,
    count(*) FILTER (WHERE l.player_id IS NOT NULL) AS legacy_count,
    count(*) FILTER (WHERE j.player_id IS NOT NULL) AS join_count,
    count(*) FILTER (
      WHERE l.player_id IS NOT NULL
        AND j.player_id IS NOT NULL
        AND l.jersey_number IS NOT DISTINCT FROM j.jersey_number
        AND l.position IS NOT DISTINCT FROM j.position
        AND l.status IS NOT DISTINCT FROM j.status
        AND l.is_active IS NOT DISTINCT FROM j.is_active
        AND l.is_laz_player IS NOT DISTINCT FROM j.is_laz_player
    ) AS field_match_count,
    count(*) FILTER (
      WHERE l.player_id IS NULL OR j.player_id IS NULL
         OR l.jersey_number IS DISTINCT FROM j.jersey_number
         OR l.position IS DISTINCT FROM j.position
         OR l.status IS DISTINCT FROM j.status
         OR l.is_active IS DISTINCT FROM j.is_active
         OR l.is_laz_player IS DISTINCT FROM j.is_laz_player
    ) AS mismatch_count
  FROM legacy l
  FULL OUTER JOIN join_rows j
    ON j.player_id = l.player_id
   AND j.team_season_id = l.team_season_id
  GROUP BY 1
)
SELECT
  team_season_id,
  legacy_count,
  join_count,
  field_match_count,
  mismatch_count,
  CASE WHEN mismatch_count = 0 AND legacy_count = join_count THEN 'MATCH' ELSE 'MISMATCH' END AS verdict
FROM per_season
ORDER BY team_season_id;
