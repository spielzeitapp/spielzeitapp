-- STEP 4B ALT vs NEU Vergleich (nach Migration; Join = Source).
-- Season: U11 SPG Rohrbach 2025/26

-- A) Kader counts
SELECT
  (SELECT count(*) FROM public.players WHERE team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c') AS legacy_roster,
  (SELECT count(*) FROM public.team_season_players WHERE team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c' AND left_at IS NULL) AS join_roster;

-- B) player_ids set equality
SELECT
  count(*) FILTER (WHERE l.id IS NULL) AS only_join,
  count(*) FILTER (WHERE j.player_id IS NULL) AS only_legacy,
  count(*) FILTER (WHERE l.id IS NOT NULL AND j.player_id IS NOT NULL) AS both
FROM (SELECT id FROM public.players WHERE team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c') l
FULL OUTER JOIN (
  SELECT player_id FROM public.team_season_players
  WHERE team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c' AND left_at IS NULL
) j ON j.player_id = l.id;

-- C) Helper sanity
SELECT
  count(*) AS in_join_helper
FROM public.players p
WHERE public.player_in_team_season(p.id, '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c');
