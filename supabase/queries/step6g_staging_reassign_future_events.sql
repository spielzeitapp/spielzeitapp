-- STEP 6G Staging: zukünftige U11-Events → U12 (gleiche event.id)
-- Read-only Preflight + controlled UPDATE. Kein Live.

-- PRE: Training 10.08
SELECT e.id,
       e.team_season_id AS before_ts,
       e.kind,
       (e.starts_at AT TIME ZONE 'Europe/Vienna')::date AS d,
       (SELECT count(*) FROM public.event_attendance ea WHERE ea.event_id = e.id) AS rsvp,
       (SELECT count(*) FROM public.notification_jobs nj WHERE nj.event_id = e.id AND nj.status = 'pending') AS pending_jobs
FROM public.events e
WHERE e.id = 'a0cf098f-fbbd-4a01-aa9d-e5ec2fe6d7e4';

-- MOVE all future U11 events to U12 active
UPDATE public.events
SET team_season_id = '5dd421cd-b47f-4889-8867-9bc1fa451c09'
WHERE team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c'
  AND starts_at >= now()
  AND coalesce(status, '') NOT IN ('canceled', 'cancelled', 'deleted');

-- POST: Training 10.08
SELECT e.id,
       e.team_season_id AS after_ts,
       e.kind,
       (e.starts_at AT TIME ZONE 'Europe/Vienna')::date AS d,
       (SELECT count(*) FROM public.event_attendance ea WHERE ea.event_id = e.id) AS rsvp,
       (SELECT count(*) FROM public.notification_jobs nj WHERE nj.event_id = e.id AND nj.status = 'pending') AS pending_jobs
FROM public.events e
WHERE e.id = 'a0cf098f-fbbd-4a01-aa9d-e5ec2fe6d7e4';

-- POST counts
SELECT
  (SELECT count(*) FROM public.events WHERE team_season_id = '55cb9ae9-aa47-4ae5-8bb4-77d100693e1c' AND starts_at >= now()) AS u11_future_left,
  (SELECT count(*) FROM public.events WHERE team_season_id = '5dd421cd-b47f-4889-8867-9bc1fa451c09' AND starts_at >= now()) AS u12_future,
  (SELECT count(*) FROM public.events WHERE id = 'a0cf098f-fbbd-4a01-aa9d-e5ec2fe6d7e4') AS train_10_still_one_row;

-- Historisches Match bleibt U11
SELECT id, team_season_id, opponent, starts_at
FROM public.events
WHERE id = '90ce27f7-ca3e-48d9-bfaf-66f4b3f5c9a3';
