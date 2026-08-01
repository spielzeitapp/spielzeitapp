-- STEP 6G inventory (Staging, read-only)
-- U11 archived: 55cb9ae9-aa47-4ae5-8bb4-77d100693e1c
-- U12 active:   5dd421cd-b47f-4889-8867-9bc1fa451c09

SELECT ts.id,
       ts.status,
       ts.display_name,
       ts.age_group,
       s.name AS season_name
FROM public.team_seasons ts
LEFT JOIN public.seasons s ON s.id = ts.season_id
WHERE ts.id IN (
  '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c',
  '5dd421cd-b47f-4889-8867-9bc1fa451c09'
);

-- Future events still on U11 (from now)
SELECT e.id,
       e.type,
       e.kind,
       e.opponent,
       e.starts_at,
       e.status,
       e.team_season_id,
       e.match_id,
       left(coalesce(e.notes, ''), 80) AS notes_preview,
       e.location,
       (SELECT count(*) FROM public.event_attendance ea WHERE ea.event_id = e.id) AS rsvp_count,
       (SELECT count(*) FROM public.event_attendance ea WHERE ea.event_id = e.id AND ea.status = 'yes') AS rsvp_yes,
       (SELECT count(*) FROM public.event_attendance ea WHERE ea.event_id = e.id AND ea.status = 'no') AS rsvp_no,
       (SELECT count(*) FROM public.event_attendance ea WHERE ea.event_id = e.id AND ea.status = 'maybe') AS rsvp_maybe,
       (SELECT count(*) FROM public.notification_jobs nj WHERE nj.event_id = e.id AND nj.status = 'pending') AS jobs_pending,
       (SELECT count(*) FROM public.notification_jobs nj WHERE nj.event_id = e.id) AS jobs_all,
       (SELECT count(*) FROM public.tournament_participants tp WHERE tp.tournament_event_id = e.id) AS tp_count,
       (SELECT count(*) FROM public.tournament_matches tm WHERE tm.tournament_event_id = e.id) AS tm_count
FROM public.events e
WHERE e.team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c'
  AND e.starts_at >= now()
ORDER BY e.starts_at;

-- Specifically 10.08.2026 window (Europe/Vienna day)
SELECT e.id, e.type, e.kind, e.starts_at, e.team_season_id, e.status
FROM public.events e
WHERE e.team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c'
  AND e.starts_at >= '2026-08-10 00:00:00+02'
  AND e.starts_at <  '2026-08-11 00:00:00+02';

-- Future on U12
SELECT e.id, e.type, e.kind, e.opponent, e.starts_at, e.status
FROM public.events e
WHERE e.team_season_id = '5dd421cd-b47f-4889-8867-9bc1fa451c09'
  AND e.starts_at >= now()
ORDER BY e.starts_at;

-- Past championship example stays U11
SELECT e.id, e.type, e.kind, e.opponent, e.starts_at, e.team_season_id, e.match_id
FROM public.events e
WHERE e.team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c'
  AND e.starts_at::date = '2026-06-13'
ORDER BY e.starts_at;
