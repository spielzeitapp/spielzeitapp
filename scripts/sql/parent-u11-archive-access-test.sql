-- Run as the database administrator after the migration. No application rows
-- are changed. Uses an existing parent of an active team with a U11 archive.
DO $$
DECLARE
  fixture record;
  expected_events bigint;
  expected_matches bigint;
  expected_roster bigint;
  expected_snapshots bigint;
  actual_count bigint;
BEGIN
  SELECT m.user_id, archived.id AS archive_id, archived.season_id,
         current_season.id AS current_id
  INTO fixture
  FROM public.memberships m
  JOIN public.team_seasons current_season ON current_season.id=m.team_season_id
  JOIN public.team_seasons archived ON archived.team_id=current_season.team_id
  WHERE m.role::text='parent' AND current_season.status='active'
    AND current_season.archived_at IS NULL
    AND archived.status='archived' AND upper(trim(archived.age_group))='U11'
  ORDER BY EXISTS (SELECT 1 FROM public.memberships old
                   WHERE old.user_id=m.user_id AND old.team_season_id=archived.id)
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No suitable parent/archive fixture'; END IF;

  SELECT count(*) INTO expected_events FROM public.events WHERE team_season_id=fixture.archive_id;
  SELECT count(*) INTO expected_matches FROM public.matches WHERE team_season_id=fixture.archive_id;
  SELECT count(*) INTO expected_roster FROM public.team_season_players WHERE team_season_id=fixture.archive_id;
  SELECT count(*) INTO expected_snapshots FROM public.match_lineup_snapshots s
    JOIN public.matches m ON m.id=s.match_id WHERE m.team_season_id=fixture.archive_id;

  PERFORM set_config('request.jwt.claim.sub', fixture.user_id::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT public.parent_can_read_u11_archive(fixture.archive_id) THEN RAISE EXCEPTION 'Parent archive denied'; END IF;
  SELECT count(*) INTO actual_count FROM public.events WHERE team_season_id=fixture.archive_id;
  IF actual_count<>expected_events THEN RAISE EXCEPTION 'Incomplete events'; END IF;
  SELECT count(*) INTO actual_count FROM public.matches WHERE team_season_id=fixture.archive_id;
  IF actual_count<>expected_matches THEN RAISE EXCEPTION 'Incomplete matches'; END IF;
  SELECT count(*) INTO actual_count FROM public.team_season_players WHERE team_season_id=fixture.archive_id;
  IF actual_count<>expected_roster THEN RAISE EXCEPTION 'Incomplete roster'; END IF;
  SELECT count(*) INTO actual_count FROM public.match_lineup_snapshots s
    JOIN public.matches m ON m.id=s.match_id WHERE m.team_season_id=fixture.archive_id;
  IF actual_count<>expected_snapshots THEN RAISE EXCEPTION 'Incomplete lineup snapshots'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.seasons WHERE id=fixture.season_id) THEN RAISE EXCEPTION 'Missing season label'; END IF;
  IF public.parent_can_read_u11_archive(fixture.current_id) THEN RAISE EXCEPTION 'Archive policy grants active season'; END IF;
  IF EXISTS(SELECT 1 FROM public.event_attendance a JOIN public.events e ON e.id=a.event_id
            WHERE e.team_season_id=fixture.archive_id AND NOT EXISTS(
              SELECT 1 FROM public.player_guardians pg WHERE pg.user_id=auth.uid() AND pg.player_id=a.player_id))
  THEN RAISE EXCEPTION 'Attendance of unrelated child exposed'; END IF;

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  IF public.parent_can_read_u11_archive(fixture.archive_id) THEN RAISE EXCEPTION 'Unrelated user granted archive'; END IF;
  IF EXISTS(SELECT 1 FROM public.matches WHERE team_season_id=fixture.archive_id) THEN RAISE EXCEPTION 'Unrelated user sees matches'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF public.parent_can_read_u11_archive(fixture.archive_id) THEN RAISE EXCEPTION 'Missing identity granted archive'; END IF;
  RESET ROLE;
  IF has_function_privilege('anon', 'public.parent_can_read_u11_archive(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can execute archive helper';
  END IF;
END $$;
SELECT 'Parent U11 archive access and isolation checks passed' AS result;
