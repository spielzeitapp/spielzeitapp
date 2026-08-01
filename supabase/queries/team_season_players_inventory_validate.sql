-- STEP 3 Inventur + Validierung (Staging).
-- Vor/Nach Migration manuell oder via Script ausführen.
-- Keine Datenänderung.

-- ========== INVENTUR ==========

-- A) Counts players
SELECT
  count(*) AS players_total,
  count(*) FILTER (WHERE team_season_id IS NOT NULL) AS players_with_season,
  count(*) FILTER (WHERE team_season_id IS NULL) AS players_without_season
FROM public.players;

-- B) Spieler je team_season
SELECT
  p.team_season_id,
  ts.status AS season_status,
  t.name AS team_name,
  s.name AS season_name,
  count(*) AS player_count
FROM public.players p
LEFT JOIN public.team_seasons ts ON ts.id = p.team_season_id
LEFT JOIN public.teams t ON t.id = ts.team_id
LEFT JOIN public.seasons s ON s.id = ts.season_id
WHERE p.team_season_id IS NOT NULL
GROUP BY p.team_season_id, ts.status, t.name, s.name
ORDER BY player_count DESC, t.name;

-- C) Mögliche Namens-Dubletten (keine Auto-Bereinigung)
SELECT
  lower(trim(coalesce(p.first_name, ''))) AS first_norm,
  lower(trim(coalesce(p.last_name, ''))) AS last_norm,
  count(*) AS n,
  array_agg(p.id::text ORDER BY p.id) AS player_ids,
  array_agg(DISTINCT p.team_season_id::text) AS team_season_ids
FROM public.players p
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY n DESC, last_norm, first_norm
LIMIT 50;

-- D) Jersey-Duplikate innerhalb einer Season (warum kein UNIQUE)
SELECT
  team_season_id,
  jersey_number,
  count(*) AS n
FROM public.players
WHERE team_season_id IS NOT NULL
  AND jersey_number IS NOT NULL
GROUP BY team_season_id, jersey_number
HAVING count(*) > 1
ORDER BY n DESC
LIMIT 30;

-- ========== NACH BACKFILL ==========

-- E) Count-Vergleich
SELECT
  (SELECT count(*) FROM public.players WHERE team_season_id IS NOT NULL) AS players_with_season,
  (SELECT count(*) FROM public.team_season_players) AS roster_rows,
  (SELECT count(*) FROM public.players WHERE team_season_id IS NOT NULL)
    - (SELECT count(*) FROM public.team_season_players) AS delta_players_minus_roster;

-- F) MATCH / MISMATCH Report
SELECT
  p.id AS player_id,
  trim(concat_ws(' ', p.first_name, p.last_name)) AS player_name,
  p.team_season_id AS players_team_season_id,
  tsp.team_season_id AS roster_team_season_id,
  CASE
    WHEN p.team_season_id IS NULL AND tsp.id IS NULL THEN 'NO_SEASON'
    WHEN p.team_season_id IS NOT NULL AND tsp.id IS NULL THEN 'MISSING_ROSTER'
    WHEN p.team_season_id IS NOT NULL
      AND tsp.team_season_id IS NOT NULL
      AND p.team_season_id = tsp.team_season_id THEN 'MATCH'
    ELSE 'MISMATCH'
  END AS verdict
FROM public.players p
LEFT JOIN public.team_season_players tsp
  ON tsp.player_id = p.id
 AND tsp.team_season_id = p.team_season_id
ORDER BY
  CASE
    WHEN p.team_season_id IS NOT NULL AND tsp.id IS NULL THEN 0
    WHEN p.team_season_id IS NOT NULL
      AND tsp.team_season_id IS DISTINCT FROM p.team_season_id THEN 1
    ELSE 2
  END,
  player_name;

-- G) Nur Probleme
SELECT *
FROM (
  SELECT
    p.id AS player_id,
    trim(concat_ws(' ', p.first_name, p.last_name)) AS player_name,
    p.team_season_id AS players_team_season_id,
    tsp.team_season_id AS roster_team_season_id,
    CASE
      WHEN p.team_season_id IS NULL THEN 'NO_SEASON'
      WHEN tsp.id IS NULL THEN 'MISSING_ROSTER'
      WHEN p.team_season_id = tsp.team_season_id THEN 'MATCH'
      ELSE 'MISMATCH'
    END AS verdict
  FROM public.players p
  LEFT JOIN public.team_season_players tsp
    ON tsp.player_id = p.id
   AND tsp.team_season_id = p.team_season_id
) x
WHERE x.verdict IN ('MISSING_ROSTER', 'MISMATCH');

-- H) Orphan Join-Rows (sollte 0 sein nach Backfill-only)
SELECT tsp.*
FROM public.team_season_players tsp
LEFT JOIN public.players p ON p.id = tsp.player_id
WHERE p.id IS NULL
   OR p.team_season_id IS DISTINCT FROM tsp.team_season_id;

-- I) Guardian-Unversehrtheit (Counts vor/nach gleich halten)
SELECT
  (SELECT count(*) FROM public.player_guardians) AS guardian_links,
  (SELECT count(*) FROM public.player_users) AS player_user_links;

-- J) Stichprobe: Matches/Events Counts (Unversehrtheit)
SELECT
  (SELECT count(*) FROM public.matches) AS matches_total,
  (SELECT count(*) FROM public.events) AS events_total,
  (SELECT count(*) FROM public.match_events) AS match_events_total,
  (SELECT count(*) FROM public.event_attendance) AS attendance_total;
