BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE is_admin=true LIMIT 1),true);
SELECT set_config('test.photo_season',(SELECT ts.id::text FROM public.team_seasons ts JOIN public.teams t ON t.id=ts.team_id JOIN public.clubs c ON c.id=t.club_id WHERE ts.status='active' AND c.status='active' LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE sid uuid:=current_setting('test.photo_season')::uuid; BEGIN
 INSERT INTO public.team_photos(team_season_id,photo_url,updated_at) VALUES(sid,'https://example.invalid/synthetic-team-photo.png',now()) ON CONFLICT(team_season_id) DO UPDATE SET photo_url=excluded.photo_url;
 ASSERT EXISTS(SELECT 1 FROM public.team_photos WHERE team_season_id=sid AND photo_url='https://example.invalid/synthetic-team-photo.png');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  UPDATE public.team_photos SET photo_url='https://example.invalid/forbidden.png' WHERE team_season_id=current_setting('test.photo_season')::uuid;
  ASSERT NOT FOUND, 'Non-staff updated a team photo';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
